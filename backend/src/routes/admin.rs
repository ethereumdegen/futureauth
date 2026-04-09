use axum::{
    extract::{Query, State},
    Json,
};
use serde::Deserialize;

use crate::error::AppError;
use crate::middleware::admin_auth::AdminAuth;
use crate::AppState;

/// GET /api/admin/overview
pub async fn overview(
    _auth: AdminAuth,
    State(state): State<AppState>,
) -> Result<Json<serde_json::Value>, AppError> {
    let total_projects: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM project")
        .fetch_one(&state.db)
        .await?;

    let total_users: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM \"user\"")
        .fetch_one(&state.db)
        .await?;

    let free_count: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM project p LEFT JOIN project_plan pp ON p.id = pp.project_id WHERE pp.plan IS NULL OR pp.plan = 'free'"
    )
    .fetch_one(&state.db)
    .await?;

    let pro_count: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM project_plan WHERE plan = 'pro'"
    )
    .fetch_one(&state.db)
    .await?;

    let today_total_usage: i64 = sqlx::query_scalar(
        "SELECT COALESCE(SUM(email_count::bigint), 0) FROM daily_usage WHERE usage_date = CURRENT_DATE"
    )
    .fetch_one(&state.db)
    .await?;

    Ok(Json(serde_json::json!({
        "total_projects": total_projects,
        "total_users": total_users,
        "plans": {
            "free": free_count,
            "pro": pro_count,
        },
        "today_total_usage": today_total_usage,
    })))
}

/// GET /api/admin/projects
pub async fn list_projects(
    _auth: AdminAuth,
    State(state): State<AppState>,
) -> Result<Json<serde_json::Value>, AppError> {
    let rows: Vec<(
        String,
        String,
        String,
        Option<String>,
        Option<i32>,
        Option<String>,
        Option<String>,
        chrono::DateTime<chrono::Utc>,
    )> = sqlx::query_as(
        "SELECT p.id, p.name,
                COALESCE(u.email, '') as owner_email,
                pp.plan,
                du.email_count,
                pp.stripe_customer_id,
                pp.stripe_subscription_id,
                p.created_at
         FROM project p
         LEFT JOIN \"user\" u ON p.user_id = u.id
         LEFT JOIN project_plan pp ON p.id = pp.project_id
         LEFT JOIN daily_usage du ON p.id = du.project_id AND du.usage_date = CURRENT_DATE
         ORDER BY p.created_at DESC"
    )
    .fetch_all(&state.db)
    .await?;

    let projects: Vec<serde_json::Value> = rows
        .into_iter()
        .map(|(id, name, email, plan, usage, stripe_customer, stripe_sub, created_at)| {
            serde_json::json!({
                "id": id,
                "name": name,
                "owner_email": email,
                "plan": plan.unwrap_or_else(|| "free".to_string()),
                "usage_today": usage.unwrap_or(0),
                "stripe_customer_id": stripe_customer,
                "stripe_subscription_id": stripe_sub,
                "has_subscription": stripe_sub.is_some(),
                "created_at": created_at,
            })
        })
        .collect();

    Ok(Json(serde_json::json!({ "projects": projects })))
}

#[derive(Deserialize)]
pub struct AdminLogsQuery {
    pub limit: Option<i64>,
    pub offset: Option<i64>,
    pub project_id: Option<String>,
    pub event: Option<String>,
    pub success: Option<bool>,
    pub search: Option<String>,
}

/// GET /api/admin/logs
/// Global OTP log viewer across all projects. Supports filtering by project,
/// event type, success status, and email substring.
pub async fn list_logs(
    _auth: AdminAuth,
    State(state): State<AppState>,
    Query(query): Query<AdminLogsQuery>,
) -> Result<Json<serde_json::Value>, AppError> {
    let limit = query.limit.unwrap_or(100).clamp(1, 500);
    let offset = query.offset.unwrap_or(0).max(0);

    // Build dynamic WHERE clause. We bind params sequentially.
    let mut where_clauses: Vec<String> = Vec::new();
    let mut bind_idx = 1;

    if query.project_id.is_some() {
        where_clauses.push(format!("l.project_id = ${bind_idx}"));
        bind_idx += 1;
    }
    if query.event.is_some() {
        where_clauses.push(format!("l.event = ${bind_idx}"));
        bind_idx += 1;
    }
    if query.success.is_some() {
        where_clauses.push(format!("l.success = ${bind_idx}"));
        bind_idx += 1;
    }
    if query.search.is_some() {
        where_clauses.push(format!("l.email ILIKE ${bind_idx}"));
        bind_idx += 1;
    }

    let where_sql = if where_clauses.is_empty() {
        String::new()
    } else {
        format!("WHERE {}", where_clauses.join(" AND "))
    };

    let count_sql = format!("SELECT COUNT(*) FROM otp_log l {where_sql}");
    let list_sql = format!(
        "SELECT l.id, l.event, l.email, l.ip, l.success, l.created_at,
                l.project_id, COALESCE(p.name, '') as project_name
         FROM otp_log l
         LEFT JOIN project p ON l.project_id = p.id
         {where_sql}
         ORDER BY l.created_at DESC
         LIMIT ${limit_idx} OFFSET ${offset_idx}",
        limit_idx = bind_idx,
        offset_idx = bind_idx + 1,
    );

    let mut count_q = sqlx::query_scalar::<_, i64>(&count_sql);
    let mut list_q = sqlx::query_as::<
        _,
        (
            String,
            String,
            String,
            Option<String>,
            bool,
            chrono::DateTime<chrono::Utc>,
            Option<String>,
            String,
        ),
    >(&list_sql);

    if let Some(ref pid) = query.project_id {
        count_q = count_q.bind(pid);
        list_q = list_q.bind(pid);
    }
    if let Some(ref ev) = query.event {
        count_q = count_q.bind(ev);
        list_q = list_q.bind(ev);
    }
    if let Some(s) = query.success {
        count_q = count_q.bind(s);
        list_q = list_q.bind(s);
    }
    if let Some(ref search) = query.search {
        let pattern = format!("%{search}%");
        count_q = count_q.bind(pattern.clone());
        list_q = list_q.bind(pattern);
    }

    list_q = list_q.bind(limit).bind(offset);

    let total: i64 = count_q.fetch_one(&state.db).await?;
    let rows = list_q.fetch_all(&state.db).await?;

    let logs: Vec<serde_json::Value> = rows
        .into_iter()
        .map(|(id, event, email, ip, success, created_at, project_id, project_name)| {
            serde_json::json!({
                "id": id,
                "event": event,
                "email": email,
                "ip": ip,
                "success": success,
                "created_at": created_at,
                "project_id": project_id,
                "project_name": project_name,
            })
        })
        .collect();

    Ok(Json(serde_json::json!({
        "logs": logs,
        "total": total,
    })))
}

/// GET /api/admin/config
pub async fn get_config(
    _auth: AdminAuth,
    State(state): State<AppState>,
) -> Result<Json<serde_json::Value>, AppError> {
    Ok(Json(serde_json::json!({
        "email_enabled": state.config.email_enabled(),
        "sms_enabled": state.config.sms_enabled(),
        "stripe_enabled": state.config.stripe_enabled(),
        "stripe_secret_key_set": state.config.stripe_secret_key.is_some(),
        "stripe_webhook_secret_set": state.config.stripe_webhook_secret.is_some(),
        "stripe_price_id_set": state.config.stripe_price_id.is_some(),
        "admin_emails_count": state.config.admin_emails.len(),
    })))
}
