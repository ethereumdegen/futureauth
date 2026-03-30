use axum::{
    extract::State,
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use serde::Deserialize;

use crate::middleware::project_auth::ProjectAuth;
use crate::AppState;

#[derive(Deserialize)]
pub struct SendOtpRequest {
    pub channel: String,
    pub destination: String,
    pub code: String,
    pub project_name: Option<String>,
}

/// POST /api/v1/otp/send
/// Called by the SDK to deliver an OTP code via email or SMS.
/// Authenticated with project secret key.
pub async fn send(
    project_auth: ProjectAuth,
    State(state): State<AppState>,
    Json(body): Json<SendOtpRequest>,
) -> impl IntoResponse {
    // Rate limit by email per project: 10 codes per 60 seconds
    let email_key = format!("{}:{}", project_auth.project.id, body.destination);
    if !state.otp_send_email_limiter.check(&email_key).await {
        return (
            StatusCode::TOO_MANY_REQUESTS,
            Json(serde_json::json!({ "error": "Too many codes requested for this destination, try again later" })),
        )
            .into_response();
    }

    let project_name = body
        .project_name
        .as_deref()
        .unwrap_or(&project_auth.project.name);

    match body.channel.as_str() {
        "email" => {
            let api_key = match &state.config.resend_api_key {
                Some(k) => k,
                None => {
                    return (
                        StatusCode::SERVICE_UNAVAILABLE,
                        Json(serde_json::json!({ "error": "Email delivery not configured" })),
                    )
                        .into_response()
                }
            };

            match crate::services::email::send_otp_email(
                &state.http,
                api_key,
                &state.config.resend_from_email,
                &body.destination,
                &body.code,
                project_name,
            )
            .await
            {
                Ok(()) => (StatusCode::OK, Json(serde_json::json!({ "ok": true }))).into_response(),
                Err(e) => {
                    tracing::error!("Email delivery failed: {e}");
                    (
                        StatusCode::INTERNAL_SERVER_ERROR,
                        Json(serde_json::json!({ "error": "Failed to send email" })),
                    )
                        .into_response()
                }
            }
        }
        "sms" => {
            let (sid, token, from) = match (
                &state.config.twilio_account_sid,
                &state.config.twilio_auth_token,
                &state.config.twilio_phone_number,
            ) {
                (Some(s), Some(t), Some(f)) => (s, t, f),
                _ => {
                    return (
                        StatusCode::SERVICE_UNAVAILABLE,
                        Json(serde_json::json!({ "error": "SMS delivery not configured" })),
                    )
                        .into_response()
                }
            };

            let message = format!("Your {} code is: {}", project_name, body.code);
            match crate::services::sms::send_otp_sms(
                &state.http,
                sid,
                token,
                from,
                &body.destination,
                &message,
            )
            .await
            {
                Ok(()) => (StatusCode::OK, Json(serde_json::json!({ "ok": true }))).into_response(),
                Err(e) => {
                    tracing::error!("SMS delivery failed: {e}");
                    (
                        StatusCode::INTERNAL_SERVER_ERROR,
                        Json(serde_json::json!({ "error": "Failed to send SMS" })),
                    )
                        .into_response()
                }
            }
        }
        _ => (
            StatusCode::BAD_REQUEST,
            Json(serde_json::json!({ "error": "channel must be 'email' or 'sms'" })),
        )
            .into_response(),
    }
}
