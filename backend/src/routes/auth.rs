use axum::{
    extract::State,
    http::{HeaderMap, StatusCode},
    response::IntoResponse,
    Json,
};
use serde::Deserialize;

use crate::AppState;

#[derive(Deserialize)]
pub struct SendOtpRequest {
    pub email: String,
}

#[derive(Deserialize)]
pub struct VerifyOtpRequest {
    pub email: String,
    pub code: String,
}

/// Send OTP — stores code in SDK's verification table, sends email directly.
/// This is the only auth route that doesn't fully delegate to the SDK,
/// because this server IS the email delivery service.
pub async fn send_otp(
    State(state): State<AppState>,
    Json(body): Json<SendOtpRequest>,
) -> impl IntoResponse {
    // Generate code
    let code: String = {
        use rand::Rng;
        let mut rng = rand::thread_rng();
        (0..6).map(|_| rng.gen_range(0..10).to_string()).collect()
    };

    // Delete old codes and store new one (same table the SDK's verify_otp reads from)
    let _ = sqlx::query("DELETE FROM verification WHERE identifier = $1")
        .bind(&body.email)
        .execute(&state.db)
        .await;

    let id = nanoid::nanoid!();
    let expires_at = chrono::Utc::now() + chrono::Duration::minutes(10);
    if let Err(e) = sqlx::query(
        "INSERT INTO verification (id, identifier, code, expires_at) VALUES ($1, $2, $3, $4)",
    )
    .bind(&id)
    .bind(&body.email)
    .bind(&code)
    .bind(expires_at)
    .execute(&state.db)
    .await
    {
        tracing::error!("Failed to store verification: {e}");
        return (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({ "error": "Failed to send code" }))).into_response();
    }

    // Send via Resend directly (we ARE the email service)
    if let Some(api_key) = &state.config.resend_api_key {
        if let Err(e) = crate::services::email::send_otp_email(
            &state.http,
            api_key,
            &state.config.resend_from_email,
            &body.email,
            &code,
            "FutureAuth",
        )
        .await
        {
            tracing::error!("Failed to send email: {e}");
            return (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({ "error": "Failed to send code" }))).into_response();
        }
    } else {
        tracing::info!("[FutureAuth] Dashboard OTP {code} → {}", body.email);
    }

    (StatusCode::OK, Json(serde_json::json!({ "ok": true }))).into_response()
}

/// Verify OTP — fully delegated to the SDK. Creates user + session in SDK tables.
pub async fn verify_otp(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(body): Json<VerifyOtpRequest>,
) -> impl IntoResponse {
    let ip = headers
        .get("x-forwarded-for")
        .or_else(|| headers.get("x-real-ip"))
        .and_then(|v| v.to_str().ok())
        .map(|s| s.split(',').next().unwrap_or(s).trim().to_string());

    let ua = headers
        .get("user-agent")
        .and_then(|v| v.to_str().ok())
        .map(|s| s.to_string());

    match state.auth.verify_otp(&body.email, &body.code, ip.as_deref(), ua.as_deref()).await {
        Ok((user, session)) => {
            let cookie_name = &state.auth.config.cookie_name;
            let cookie = format!(
                "{cookie_name}={}; Path=/; HttpOnly; SameSite=Lax; Max-Age={}",
                session.token,
                state.auth.config.session_ttl.as_secs()
            );
            (
                StatusCode::OK,
                [("set-cookie", cookie)],
                Json(serde_json::json!({ "user": user })),
            )
                .into_response()
        }
        Err(e) => {
            tracing::warn!("OTP verification failed: {e}");
            (StatusCode::BAD_REQUEST, Json(serde_json::json!({ "error": "Invalid or expired code" }))).into_response()
        }
    }
}

/// Get session — fully delegated to the SDK.
pub async fn get_session(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> impl IntoResponse {
    let cookie_header = headers.get("cookie").and_then(|v| v.to_str().ok()).unwrap_or("");
    let cookie_name = &state.auth.config.cookie_name;
    let token = cookie_header
        .split(';')
        .filter_map(|c| c.trim().strip_prefix(&format!("{cookie_name}=")))
        .next();

    let token = match token {
        Some(t) => t,
        None => return (StatusCode::UNAUTHORIZED, Json(serde_json::json!({ "error": "Not authenticated" }))).into_response(),
    };

    match state.auth.get_session(token).await {
        Ok(Some((user, _session))) => {
            (StatusCode::OK, Json(serde_json::json!({ "user": user }))).into_response()
        }
        _ => (StatusCode::UNAUTHORIZED, Json(serde_json::json!({ "error": "Not authenticated" }))).into_response(),
    }
}

/// Sign out — fully delegated to the SDK.
pub async fn sign_out(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> impl IntoResponse {
    let cookie_header = headers.get("cookie").and_then(|v| v.to_str().ok()).unwrap_or("");
    let cookie_name = &state.auth.config.cookie_name;
    if let Some(token) = cookie_header
        .split(';')
        .filter_map(|c| c.trim().strip_prefix(&format!("{cookie_name}=")))
        .next()
    {
        let _ = state.auth.revoke_session(token).await;
    }

    let clear = format!("{cookie_name}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0");
    (StatusCode::OK, [("set-cookie", clear)], Json(serde_json::json!({ "ok": true })))
}
