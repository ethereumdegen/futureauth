use axum::{
    extract::FromRequestParts,
    http::{StatusCode, request::Parts},
};

use crate::models::api_key::DeveloperApiKey;
use crate::AppState;

/// Authenticated dashboard user. Uses the SDK's "user" table for identity.
pub struct DashboardAuth {
    pub user_id: String,
    pub email: String,
}

impl FromRequestParts<AppState> for DashboardAuth {
    type Rejection = StatusCode;

    async fn from_request_parts(
        parts: &mut Parts,
        state: &AppState,
    ) -> Result<Self, Self::Rejection> {
        // Try API key first
        if let Some(auth_header) = parts.headers.get("authorization").and_then(|v| v.to_str().ok()) {
            if let Some(key) = auth_header.strip_prefix("Bearer vxk_") {
                let raw_key = format!("vxk_{key}");
                if let Ok(Some((user_id, email))) = DeveloperApiKey::resolve_user(&state.db, &raw_key).await {
                    return Ok(DashboardAuth { user_id, email });
                }
                return Err(StatusCode::UNAUTHORIZED);
            }
        }

        // Try session cookie via SDK
        let cookie_header = parts
            .headers
            .get("cookie")
            .and_then(|v| v.to_str().ok())
            .unwrap_or("");

        let cookie_name = &state.auth.config.cookie_name;
        let token = cookie_header
            .split(';')
            .filter_map(|c| c.trim().strip_prefix(&format!("{cookie_name}=")))
            .next()
            .ok_or(StatusCode::UNAUTHORIZED)?;

        let (user, _session) = state.auth
            .get_session(token)
            .await
            .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
            .ok_or(StatusCode::UNAUTHORIZED)?;

        Ok(DashboardAuth {
            user_id: user.id,
            email: user.email.unwrap_or_default(),
        })
    }
}
