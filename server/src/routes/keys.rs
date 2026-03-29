use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use serde::Deserialize;

use crate::error::AppError;
use crate::middleware::dashboard_auth::DashboardAuth;
use crate::models::api_key::{hash_key, DeveloperApiKey};
use crate::AppState;

#[derive(Deserialize)]
pub struct CreateKeyRequest {
    pub name: Option<String>,
}

pub async fn list(
    auth: DashboardAuth,
    State(state): State<AppState>,
) -> Result<Json<Vec<DeveloperApiKey>>, AppError> {
    let keys = DeveloperApiKey::list_for_developer(&state.db, &auth.developer.id).await?;
    Ok(Json(keys))
}

pub async fn create(
    auth: DashboardAuth,
    State(state): State<AppState>,
    Json(body): Json<CreateKeyRequest>,
) -> Result<impl IntoResponse, AppError> {
    let name = body.name.unwrap_or_else(|| "Untitled".into());
    let raw_key = format!("vxk_{}", nanoid::nanoid!(40));
    let prefix = format!("{}...", &raw_key[..12]);
    let hash = hash_key(&raw_key);

    let key = DeveloperApiKey::create(&state.db, &auth.developer.id, &name, &hash, &prefix).await?;

    Ok((
        StatusCode::CREATED,
        Json(serde_json::json!({
            "id": key.id,
            "name": key.name,
            "key": raw_key,
            "key_prefix": key.key_prefix,
            "created_at": key.created_at,
        })),
    ))
}

pub async fn delete(
    auth: DashboardAuth,
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> Result<StatusCode, AppError> {
    DeveloperApiKey::delete(&state.db, &id, &auth.developer.id).await?;
    Ok(StatusCode::NO_CONTENT)
}
