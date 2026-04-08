use axum::{
    extract::FromRequestParts,
    http::{StatusCode, request::Parts},
};

use crate::middleware::dashboard_auth::DashboardAuth;
use crate::AppState;

/// Authenticated admin user. Reuses DashboardAuth then checks admin_emails config.
pub struct AdminAuth {
    pub user_id: String,
    pub email: String,
}

impl FromRequestParts<AppState> for AdminAuth {
    type Rejection = StatusCode;

    async fn from_request_parts(
        parts: &mut Parts,
        state: &AppState,
    ) -> Result<Self, Self::Rejection> {
        let auth = DashboardAuth::from_request_parts(parts, state).await?;

        if !state.config.is_admin(&auth.email) {
            return Err(StatusCode::FORBIDDEN);
        }

        Ok(AdminAuth {
            user_id: auth.user_id,
            email: auth.email,
        })
    }
}
