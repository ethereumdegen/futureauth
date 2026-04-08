use axum::{
    extract::State,
    Json,
};

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
    let rows: Vec<(String, String, String, Option<String>, Option<i32>)> = sqlx::query_as(
        "SELECT p.id, p.name,
                COALESCE(u.email, '') as owner_email,
                pp.plan,
                du.email_count
         FROM project p
         LEFT JOIN \"user\" u ON p.user_id = u.id
         LEFT JOIN project_plan pp ON p.id = pp.project_id
         LEFT JOIN daily_usage du ON p.id = du.project_id AND du.usage_date = CURRENT_DATE
         ORDER BY p.created_at DESC"
    )
    .fetch_all(&state.db)
    .await?;

    let projects: Vec<serde_json::Value> = rows.into_iter().map(|(id, name, email, plan, usage)| {
        serde_json::json!({
            "id": id,
            "name": name,
            "owner_email": email,
            "plan": plan.unwrap_or_else(|| "free".to_string()),
            "usage_today": usage.unwrap_or(0),
        })
    }).collect();

    Ok(Json(serde_json::json!({ "projects": projects })))
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
