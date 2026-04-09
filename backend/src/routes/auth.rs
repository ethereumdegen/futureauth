use std::net::SocketAddr;

use axum::{
    extract::{ConnectInfo, State},
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

/// Returns the client IP to use for rate limiting and logging.
///
/// When `trust_proxy_headers` is true we believe the leftmost `X-Forwarded-For`
/// (or `X-Real-IP`) entry — this is only safe behind a proxy that strips and
/// rewrites those headers. Otherwise we use the raw socket peer address so a
/// client cannot spoof its IP to bypass rate limiting.
fn extract_client_ip(
    trust_proxy: bool,
    peer: SocketAddr,
    headers: &HeaderMap,
) -> String {
    if trust_proxy {
        if let Some(ip) = headers
            .get("x-forwarded-for")
            .or_else(|| headers.get("x-real-ip"))
            .and_then(|v| v.to_str().ok())
            .and_then(|s| s.split(',').next())
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty())
        {
            return ip;
        }
    }
    peer.ip().to_string()
}

/// Send OTP — stores code in SDK's verification table, sends email directly.
/// This is the only auth route that doesn't fully delegate to the SDK,
/// because this server IS the email delivery service.
pub async fn send_otp(
    State(state): State<AppState>,
    ConnectInfo(peer): ConnectInfo<SocketAddr>,
    headers: HeaderMap,
    Json(body): Json<SendOtpRequest>,
) -> impl IntoResponse {
    if !is_valid_email(&body.email) {
        return (StatusCode::BAD_REQUEST, Json(serde_json::json!({ "error": "Invalid email address" }))).into_response();
    }

    // Rate limit by IP: 5 requests per 60 seconds
    let ip = extract_client_ip(state.config.trust_proxy_headers, peer, &headers);
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

    // Store the code in the SDK's verification table (hashed at rest).
    // 2-minute TTL for dashboard OTP codes.
    if let Err(e) = state
        .auth
        .store_otp(&body.email, &code, std::time::Duration::from_secs(120))
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
    ConnectInfo(peer): ConnectInfo<SocketAddr>,
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
    let client_ip = extract_client_ip(state.config.trust_proxy_headers, peer, &headers);
    if !state.otp_verify_limiter.check(&client_ip).await {
        return (StatusCode::TOO_MANY_REQUESTS, Json(serde_json::json!({ "error": "Too many attempts, try again later" }))).into_response();
    }

    let ua = headers
        .get("user-agent")
        .and_then(|v| v.to_str().ok())
        .map(|s| s.to_string());

    let result = state.auth.verify_otp(&body.email, &body.code, Some(&client_ip), ua.as_deref()).await;
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
        Err(futureauth::FutureAuthError::OtpMaxAttempts) => {
            tracing::warn!("OTP max attempts exceeded for {}", body.email);
            (StatusCode::TOO_MANY_REQUESTS, Json(serde_json::json!({ "error": "Too many failed attempts, please request a new code" }))).into_response()
        }
        Err(futureauth::FutureAuthError::InvalidOtp | futureauth::FutureAuthError::OtpExpired) => {
            tracing::warn!("OTP verification failed for {}", body.email);
            (StatusCode::BAD_REQUEST, Json(serde_json::json!({ "error": "Invalid or expired code" }))).into_response()
        }
        Err(e) => {
            tracing::error!("OTP verification error: {e}");
            (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({ "error": "Verification failed" }))).into_response()
        }
    }
}

#[derive(Deserialize)]
pub struct SendMagicLinkRequest {
    pub email: String,
}

#[derive(Deserialize)]
pub struct VerifyMagicLinkRequest {
    pub token: String,
}

/// Send magic link — stores token in SDK's verification table, sends email directly.
pub async fn send_magic_link(
    State(state): State<AppState>,
    ConnectInfo(peer): ConnectInfo<SocketAddr>,
    headers: HeaderMap,
    Json(body): Json<SendMagicLinkRequest>,
) -> impl IntoResponse {
    if !is_valid_email(&body.email) {
        return (StatusCode::BAD_REQUEST, Json(serde_json::json!({ "error": "Invalid email address" }))).into_response();
    }

    // Rate limit by IP
    let ip = extract_client_ip(state.config.trust_proxy_headers, peer, &headers);
    if !state.otp_send_limiter.check(&ip).await {
        return (StatusCode::TOO_MANY_REQUESTS, Json(serde_json::json!({ "error": "Too many requests, try again later" }))).into_response();
    }

    // Rate limit by email
    let email_key = format!("dashboard:{}", body.email);
    if !state.otp_send_email_limiter.check(&email_key).await {
        return (StatusCode::TOO_MANY_REQUESTS, Json(serde_json::json!({ "error": "Too many requests for this email, try again later" }))).into_response();
    }

    // Generate 48-char magic link token
    let token = nanoid::nanoid!(48);

    // Store in verification table (kind='magic_link', 15min TTL, hashed at rest)
    if let Err(e) = state
        .auth
        .store_magic_link(&body.email, &token, std::time::Duration::from_secs(900))
        .await
    {
        tracing::error!("Failed to store magic link verification: {e}");
        return (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({ "error": "Failed to send magic link" }))).into_response();
    }

    // Build callback URL and send email
    let callback_url = format!("{}/auth/verify", state.config.cors_origin);
    let link = format!("{}?token={}", callback_url, token);

    let send_success;
    if let Some(api_key) = &state.config.resend_api_key {
        if let Err(e) = crate::services::email::send_magic_link_email(
            &state.http,
            api_key,
            &state.config.resend_from_email,
            &body.email,
            &link,
            "FutureAuth",
        )
        .await
        {
            tracing::error!("Failed to send magic link email: {e}");
            send_success = false;
        } else {
            send_success = true;
        }
    } else {
        tracing::debug!("[FutureAuth] Dashboard magic link for {}: {}", body.email, link);
        send_success = true;
    }

    // Log the attempt
    let _ = sqlx::query(
        "INSERT INTO otp_log (id, event, email, ip, success) VALUES ($1, $2, $3, $4, $5)",
    )
    .bind(nanoid::nanoid!())
    .bind("send_magic_link")
    .bind(&body.email)
    .bind(&ip)
    .bind(send_success)
    .execute(&state.db)
    .await;

    if send_success {
        (StatusCode::OK, Json(serde_json::json!({ "ok": true }))).into_response()
    } else {
        (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({ "error": "Failed to send magic link" }))).into_response()
    }
}

/// Verify magic link — delegated to the SDK. Creates user + session in SDK tables.
pub async fn verify_magic_link(
    State(state): State<AppState>,
    ConnectInfo(peer): ConnectInfo<SocketAddr>,
    headers: HeaderMap,
    Json(body): Json<VerifyMagicLinkRequest>,
) -> impl IntoResponse {
    let client_ip = extract_client_ip(state.config.trust_proxy_headers, peer, &headers);

    // Rate limit by IP
    if !state.otp_verify_limiter.check(&client_ip).await {
        return (StatusCode::TOO_MANY_REQUESTS, Json(serde_json::json!({ "error": "Too many attempts, try again later" }))).into_response();
    }

    let ua = headers
        .get("user-agent")
        .and_then(|v| v.to_str().ok())
        .map(|s| s.to_string());

    let result = state.auth.verify_magic_link(&body.token, Some(&client_ip), ua.as_deref()).await;
    let success = result.is_ok();

    // Log the verify attempt
    let _ = sqlx::query(
        "INSERT INTO otp_log (id, event, email, ip, success) VALUES ($1, $2, $3, $4, $5)",
    )
    .bind(nanoid::nanoid!())
    .bind("verify_magic_link")
    .bind("")
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
        Err(futureauth::FutureAuthError::InvalidMagicLink | futureauth::FutureAuthError::MagicLinkExpired) => {
            (StatusCode::BAD_REQUEST, Json(serde_json::json!({ "error": "Invalid or expired magic link" }))).into_response()
        }
        Err(e) => {
            tracing::error!("Magic link verification error: {e}");
            (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({ "error": "Verification failed" }))).into_response()
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
