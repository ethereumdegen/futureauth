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

fn is_valid_email(email: &str) -> bool {
    let parts: Vec<&str> = email.splitn(2, '@').collect();
    if parts.len() != 2 {
        return false;
    }
    let (local, domain) = (parts[0], parts[1]);
    !local.is_empty() && domain.contains('.') && domain.len() > 2 && email.len() <= 254
}

fn extract_client_ip(headers: &HeaderMap) -> String {
    headers
        .get("x-forwarded-for")
        .or_else(|| headers.get("x-real-ip"))
        .and_then(|v| v.to_str().ok())
        .and_then(|s| s.split(',').next())
        .map(|s| s.trim().to_string())
        .unwrap_or_else(|| "unknown".to_string())
}

/// Send OTP — stores code in SDK's verification table, sends email directly.
/// This is the only auth route that doesn't fully delegate to the SDK,
/// because this server IS the email delivery service.
pub async fn send_otp(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(body): Json<SendOtpRequest>,
) -> impl IntoResponse {
    if !is_valid_email(&body.email) {
        return (StatusCode::BAD_REQUEST, Json(serde_json::json!({ "error": "Invalid email address" }))).into_response();
    }

    // Rate limit by IP: 5 requests per 60 seconds
    let ip = extract_client_ip(&headers);
    if !state.otp_send_limiter.check(&ip).await {
        return (StatusCode::TOO_MANY_REQUESTS, Json(serde_json::json!({ "error": "Too many requests, try again later" }))).into_response();
    }

    // Rate limit by email per project: 10 codes per 60 seconds
    let email_key = format!("dashboard:{}", body.email);
    if !state.otp_send_email_limiter.check(&email_key).await {
        return (StatusCode::TOO_MANY_REQUESTS, Json(serde_json::json!({ "error": "Too many codes requested for this email, try again later" }))).into_response();
    }

    // Generate alphanumeric code (lowercase)
    let code: String = {
        use rand::Rng;
        const CHARSET: &[u8] = b"abcdefghijklmnopqrstuvwxyz0123456789";
        let mut rng = rand::thread_rng();
        (0..6).map(|_| CHARSET[rng.gen_range(0..CHARSET.len())] as char).collect()
    };

    // Delete old codes and store new one (same table the SDK's verify_otp reads from)
    let _ = sqlx::query("DELETE FROM verification WHERE identifier = $1")
        .bind(&body.email)
        .execute(&state.db)
        .await;

    let id = nanoid::nanoid!();
    let expires_at = chrono::Utc::now() + chrono::Duration::minutes(2);
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
    let send_success;
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
            send_success = false;
        } else {
            send_success = true;
        }
    } else {
        tracing::debug!("[FutureAuth] Dashboard OTP generated for {}", body.email);
        send_success = true;
    }

    // Log the OTP send attempt
    let _ = sqlx::query(
        "INSERT INTO otp_log (id, event, email, ip, success) VALUES ($1, $2, $3, $4, $5)",
    )
    .bind(nanoid::nanoid!())
    .bind("send")
    .bind(&body.email)
    .bind(&ip)
    .bind(send_success)
    .execute(&state.db)
    .await;

    if send_success {
        (StatusCode::OK, Json(serde_json::json!({ "ok": true }))).into_response()
    } else {
        (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({ "error": "Failed to send code" }))).into_response()
    }
}

/// Verify OTP — fully delegated to the SDK. Creates user + session in SDK tables.
pub async fn verify_otp(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(body): Json<VerifyOtpRequest>,
) -> impl IntoResponse {
    if !is_valid_email(&body.email) {
        return (StatusCode::BAD_REQUEST, Json(serde_json::json!({ "error": "Invalid email address" }))).into_response();
    }
    if body.code.len() != 6 || !body.code.chars().all(|c| c.is_ascii_lowercase() || c.is_ascii_digit()) {
        return (StatusCode::BAD_REQUEST, Json(serde_json::json!({ "error": "Code must be exactly 6 lowercase alphanumeric characters" }))).into_response();
    }

    // Rate limit by IP: 5 attempts per 60 seconds
    let client_ip = extract_client_ip(&headers);
    if !state.otp_verify_limiter.check(&client_ip).await {
        return (StatusCode::TOO_MANY_REQUESTS, Json(serde_json::json!({ "error": "Too many attempts, try again later" }))).into_response();
    }

    let ip = headers
        .get("x-forwarded-for")
        .or_else(|| headers.get("x-real-ip"))
        .and_then(|v| v.to_str().ok())
        .map(|s| s.split(',').next().unwrap_or(s).trim().to_string());

    let ua = headers
        .get("user-agent")
        .and_then(|v| v.to_str().ok())
        .map(|s| s.to_string());

    let result = state.auth.verify_otp(&body.email, &body.code, ip.as_deref(), ua.as_deref()).await;
    let success = result.is_ok();

    // Log the OTP verify attempt
    let _ = sqlx::query(
        "INSERT INTO otp_log (id, event, email, ip, success) VALUES ($1, $2, $3, $4, $5)",
    )
    .bind(nanoid::nanoid!())
    .bind("verify")
    .bind(&body.email)
    .bind(&client_ip)
    .bind(success)
    .execute(&state.db)
    .await;

    match result {
        Ok((user, session)) => {
            let cookie_name = &state.auth.config.cookie_name;
            let cookie = format!(
                "{cookie_name}={}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age={}",
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

    let clear = format!("{cookie_name}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0");
    (StatusCode::OK, [("set-cookie", clear)], Json(serde_json::json!({ "ok": true })))
}
