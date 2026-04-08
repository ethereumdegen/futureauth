use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use serde::{Deserialize, Serialize};

use crate::error::AppError;
use crate::middleware::dashboard_auth::DashboardAuth;
use crate::models::api_key::hash_key;
use crate::models::project::Project;
use crate::AppState;

#[derive(Deserialize)]
pub struct CreateProjectRequest {
    pub name: String,
    pub otp_mode: Option<String>,
}

#[derive(Deserialize)]
pub struct UpdateProjectRequest {
    pub name: Option<String>,
    pub otp_mode: Option<String>,
    pub magic_link_callback_url: Option<String>,
}

pub async fn list(
    auth: DashboardAuth,
    State(state): State<AppState>,
) -> Result<Json<Vec<Project>>, AppError> {
    let projects = Project::list_for_user(&state.db, &auth.user_id).await?;
    Ok(Json(projects))
}

pub async fn create(
    auth: DashboardAuth,
    State(state): State<AppState>,
    Json(body): Json<CreateProjectRequest>,
) -> Result<impl IntoResponse, AppError> {
    if body.name.is_empty() {
        return Err(AppError::BadRequest("name is required".into()));
    }
    if body.name.len() > 100 {
        return Err(AppError::BadRequest("name must be 100 characters or fewer".into()));
    }

    let mode = body.otp_mode.as_deref().unwrap_or("email");
    if mode != "email" && mode != "phone" {
        return Err(AppError::BadRequest("otp_mode must be 'email' or 'phone'".into()));
    }
    if mode == "phone" && !state.config.sms_enabled() {
        return Err(AppError::BadRequest("SMS is not available — Twilio not configured".into()));
    }

    let secret_key = format!("vx_sec_{}", nanoid::nanoid!(32));
    let secret_hash = hash_key(&secret_key, &state.config.hmac_secret);

    let project = Project::create(
        &state.db,
        &auth.user_id,
        &body.name,
        mode,
        &secret_hash,
    )
    .await?;

    Ok((
        StatusCode::CREATED,
        Json(serde_json::json!({
            "id": project.id,
            "name": project.name,
            "otp_mode": project.otp_mode,
            "secret_key": secret_key,
            "created_at": project.created_at,
        })),
    ))
}

pub async fn get(
    auth: DashboardAuth,
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> Result<Json<Project>, AppError> {
    let project = Project::find_by_id(&state.db, &id, &auth.user_id)
        .await?
        .ok_or(AppError::NotFound)?;
    Ok(Json(project))
}

pub async fn update(
    auth: DashboardAuth,
    State(state): State<AppState>,
    Path(id): Path<String>,
    Json(body): Json<UpdateProjectRequest>,
) -> Result<Json<Project>, AppError> {
    let project = Project::update(
        &state.db,
        &id,
        &auth.user_id,
        body.name.as_deref(),
        body.otp_mode.as_deref(),
        body.magic_link_callback_url.as_deref(),
    )
    .await?
    .ok_or(AppError::NotFound)?;
    Ok(Json(project))
}

pub async fn regenerate_keys(
    auth: DashboardAuth,
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> Result<Json<serde_json::Value>, AppError> {
    // Verify project exists and belongs to user
    Project::find_by_id(&state.db, &id, &auth.user_id)
        .await?
        .ok_or(AppError::NotFound)?;

    let secret_key = format!("vx_sec_{}", nanoid::nanoid!(32));
    let secret_hash = hash_key(&secret_key, &state.config.hmac_secret);

    let project = Project::regenerate_keys(
        &state.db,
        &id,
        &auth.user_id,
        &secret_hash,
    )
    .await?
    .ok_or(AppError::NotFound)?;

    Ok(Json(serde_json::json!({
        "id": project.id,
        "name": project.name,
        "otp_mode": project.otp_mode,
        "secret_key": secret_key,
        "created_at": project.created_at,
        "updated_at": project.updated_at,
    })))
}

pub async fn delete(
    auth: DashboardAuth,
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> Result<StatusCode, AppError> {
    Project::delete(&state.db, &id, &auth.user_id).await?;
    Ok(StatusCode::NO_CONTENT)
}

#[derive(Deserialize)]
pub struct LogsQuery {
    pub limit: Option<i64>,
    pub offset: Option<i64>,
}

#[derive(Serialize, sqlx::FromRow)]
pub struct OtpLogEntry {
    pub id: String,
    pub event: String,
    pub email: String,
    pub ip: Option<String>,
    pub success: bool,
    pub created_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Serialize)]
pub struct LogsResponse {
    pub logs: Vec<OtpLogEntry>,
    pub total: i64,
}

pub async fn logs(
    auth: DashboardAuth,
    State(state): State<AppState>,
    Path(id): Path<String>,
    Query(query): Query<LogsQuery>,
) -> Result<Json<LogsResponse>, AppError> {
    // Verify project belongs to user
    Project::find_by_id(&state.db, &id, &auth.user_id)
        .await?
        .ok_or(AppError::NotFound)?;

    let limit = query.limit.unwrap_or(50).min(200);
    let offset = query.offset.unwrap_or(0);

    let total: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM otp_log WHERE project_id = $1",
    )
    .bind(&id)
    .fetch_one(&state.db)
    .await
    .map_err(|e| AppError::Internal(format!("Failed to count logs: {e}")))?;

    let logs: Vec<OtpLogEntry> = sqlx::query_as(
        "SELECT id, event, email, ip, success, created_at FROM otp_log WHERE project_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3",
    )
    .bind(&id)
    .bind(limit)
    .bind(offset)
    .fetch_all(&state.db)
    .await
    .map_err(|e| AppError::Internal(format!("Failed to fetch logs: {e}")))?;

    Ok(Json(LogsResponse { logs, total }))
}
