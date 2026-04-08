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

async fn log_otp_event(
    db: &sqlx::PgPool,
    event: &str,
    email: &str,
    success: bool,
    project_id: &str,
) {
    let _ = sqlx::query(
        "INSERT INTO otp_log (id, event, email, success, project_id) VALUES ($1, $2, $3, $4, $5)",
    )
    .bind(nanoid::nanoid!())
    .bind(event)
    .bind(email)
    .bind(success)
    .bind(project_id)
    .execute(db)
    .await;
}

/// POST /api/v1/otp/send
/// Called by the SDK to deliver an OTP code via email or SMS.
/// Authenticated with project secret key.
pub async fn send(
    project_auth: ProjectAuth,
    State(state): State<AppState>,
    Json(body): Json<SendOtpRequest>,
) -> impl IntoResponse {
    // Plan-based daily unique email limit
    let project_id = &project_auth.project.id;
    let plan = crate::models::project_plan::ProjectPlan::find_by_project(&state.db, project_id)
        .await
        .ok()
        .flatten();
    let daily_limit = plan.as_ref().map_or(50, |p| p.daily_limit());
    let plan_name = plan.as_ref().map_or("free", |p| p.plan.as_str()).to_string();

    let (count, _is_new) = crate::models::daily_usage::DailyUsage::record_email(
        &state.db, project_id, &body.destination,
    )
    .await
    .unwrap_or((0, false));

    if i64::from(count) > daily_limit {
        return (
            StatusCode::TOO_MANY_REQUESTS,
            Json(serde_json::json!({
                "error": format!("Daily unique email limit reached ({}/{}). Upgrade your plan for higher limits.", count, daily_limit),
                "plan": plan_name,
                "usage": count,
                "limit": daily_limit,
            })),
        )
            .into_response();
    }

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
                Ok(()) => {
                    log_otp_event(&state.db, "send", &body.destination, true, project_id).await;
                    (StatusCode::OK, Json(serde_json::json!({ "ok": true }))).into_response()
                }
                Err(e) => {
                    tracing::error!("Email delivery failed: {e}");
                    log_otp_event(&state.db, "send", &body.destination, false, project_id).await;
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
                Ok(()) => {
                    log_otp_event(&state.db, "send_sms", &body.destination, true, project_id).await;
                    (StatusCode::OK, Json(serde_json::json!({ "ok": true }))).into_response()
                }
                Err(e) => {
                    tracing::error!("SMS delivery failed: {e}");
                    log_otp_event(&state.db, "send_sms", &body.destination, false, project_id).await;
                    (
                        StatusCode::INTERNAL_SERVER_ERROR,
                        Json(serde_json::json!({ "error": "Failed to send SMS" })),
                    )
                        .into_response()
                }
            }
        }
        "magic_link" => {
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

            let callback_url = match &project_auth.project.magic_link_callback_url {
                Some(url) => url,
                None => {
                    return (
                        StatusCode::BAD_REQUEST,
                        Json(serde_json::json!({ "error": "magic_link_callback_url not configured for this project" })),
                    )
                        .into_response()
                }
            };

            let link = format!("{}?token={}", callback_url, body.code);

            match crate::services::email::send_magic_link_email(
                &state.http,
                api_key,
                &state.config.resend_from_email,
                &body.destination,
                &link,
                project_name,
            )
            .await
            {
                Ok(()) => {
                    log_otp_event(&state.db, "send_magic_link", &body.destination, true, project_id).await;
                    (StatusCode::OK, Json(serde_json::json!({ "ok": true }))).into_response()
                }
                Err(e) => {
                    tracing::error!("Magic link email delivery failed: {e}");
                    log_otp_event(&state.db, "send_magic_link", &body.destination, false, project_id).await;
                    (
                        StatusCode::INTERNAL_SERVER_ERROR,
                        Json(serde_json::json!({ "error": "Failed to send magic link email" })),
                    )
                        .into_response()
                }
            }
        }
        _ => (
            StatusCode::BAD_REQUEST,
            Json(serde_json::json!({ "error": "channel must be 'email', 'sms', or 'magic_link'" })),
        )
            .into_response(),
    }
}
