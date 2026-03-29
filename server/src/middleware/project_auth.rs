use axum::{
    extract::FromRequestParts,
    http::{StatusCode, request::Parts},
};

use crate::models::api_key::hash_key;
use crate::models::project::Project;
use crate::AppState;

/// Extracts an authenticated project from the Bearer token (project secret key).
/// Used for the OTP delivery API endpoint.
pub struct ProjectAuth {
    pub project: Project,
}

impl FromRequestParts<AppState> for ProjectAuth {
    type Rejection = StatusCode;

    async fn from_request_parts(
        parts: &mut Parts,
        state: &AppState,
    ) -> Result<Self, Self::Rejection> {
        let auth_header = parts
            .headers
            .get("authorization")
            .and_then(|v| v.to_str().ok())
            .ok_or(StatusCode::UNAUTHORIZED)?;

        let secret_key = auth_header
            .strip_prefix("Bearer ")
            .ok_or(StatusCode::UNAUTHORIZED)?;

        let hash = hash_key(secret_key);
        let project = Project::find_by_secret_hash(&state.db, &hash)
            .await
            .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
            .ok_or(StatusCode::UNAUTHORIZED)?;

        Ok(ProjectAuth { project })
    }
}
