use axum::{
    extract::FromRequestParts,
    http::{StatusCode, request::Parts},
};

use crate::models::api_key::DeveloperApiKey;
use crate::models::developer::{Developer, DeveloperSession};
use crate::AppState;

/// Extracts an authenticated developer from either a session cookie or API key.
pub struct DashboardAuth {
    pub developer: Developer,
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
                if let Ok(Some(dev)) = DeveloperApiKey::resolve(&state.db, &raw_key).await {
                    return Ok(DashboardAuth { developer: dev });
                }
                return Err(StatusCode::UNAUTHORIZED);
            }
        }

        // Try session cookie
        let cookie_header = parts
            .headers
            .get("cookie")
            .and_then(|v| v.to_str().ok())
            .unwrap_or("");

        let token = cookie_header
            .split(';')
            .filter_map(|c| c.trim().strip_prefix("futureauth_dashboard="))
            .next()
            .ok_or(StatusCode::UNAUTHORIZED)?;

        let (dev, _session) = DeveloperSession::find_by_token(&state.db, token)
            .await
            .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
            .ok_or(StatusCode::UNAUTHORIZED)?;

        Ok(DashboardAuth { developer: dev })
    }
}
