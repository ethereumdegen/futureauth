use axum::{
    extract::State,
    http::{HeaderMap, StatusCode},
    response::IntoResponse,
    Json,
};
use rand::Rng;
use serde::Deserialize;

use crate::AppState;
use crate::models::developer::{Developer, DeveloperSession};

#[derive(Deserialize)]
pub struct SendOtpRequest {
    pub email: String,
}

#[derive(Deserialize)]
pub struct VerifyOtpRequest {
    pub email: String,
    pub code: String,
}

pub async fn send_otp(
    State(state): State<AppState>,
    Json(body): Json<SendOtpRequest>,
) -> impl IntoResponse {
    let code = generate_otp(6);

    // Delete old codes for this email
    let _ = sqlx::query("DELETE FROM developer_verification WHERE email = $1")
        .bind(&body.email)
        .execute(&state.db)
        .await;

    // Store code
    let id = nanoid::nanoid!();
    let expires_at = chrono::Utc::now() + chrono::Duration::minutes(10);
    if let Err(e) = sqlx::query(
        "INSERT INTO developer_verification (id, email, code, expires_at) VALUES ($1, $2, $3, $4)",
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

    // Send via Resend
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

pub async fn verify_otp(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(body): Json<VerifyOtpRequest>,
) -> impl IntoResponse {
    // Find and validate code
    let row = sqlx::query_as::<_, (String, String, chrono::DateTime<chrono::Utc>)>(
        "SELECT id, code, expires_at FROM developer_verification WHERE email = $1 AND code = $2",
    )
    .bind(&body.email)
    .bind(&body.code)
    .fetch_optional(&state.db)
    .await;

    let (v_id, _, expires_at) = match row {
        Ok(Some(r)) => r,
        _ => {
            return (StatusCode::BAD_REQUEST, Json(serde_json::json!({ "error": "Invalid or expired code" }))).into_response();
        }
    };

    if expires_at < chrono::Utc::now() {
        let _ = sqlx::query("DELETE FROM developer_verification WHERE id = $1")
            .bind(&v_id)
            .execute(&state.db)
            .await;
        return (StatusCode::BAD_REQUEST, Json(serde_json::json!({ "error": "Code expired" }))).into_response();
    }

    // Delete used code
    let _ = sqlx::query("DELETE FROM developer_verification WHERE id = $1")
        .bind(&v_id)
        .execute(&state.db)
        .await;

    // Find or create developer
    let developer = match Developer::find_or_create_by_email(&state.db, &body.email).await {
        Ok(d) => d,
        Err(e) => {
            tracing::error!("Failed to create developer: {e}");
            return (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({ "error": "Internal error" }))).into_response();
        }
    };

    let ip = headers.get("x-forwarded-for")
        .or_else(|| headers.get("x-real-ip"))
        .and_then(|v| v.to_str().ok())
        .map(|s| s.split(',').next().unwrap_or(s).trim().to_string());

    let ua = headers.get("user-agent")
        .and_then(|v| v.to_str().ok())
        .map(|s| s.to_string());

    let session = match DeveloperSession::create(
        &state.db,
        &developer.id,
        ip.as_deref(),
        ua.as_deref(),
    )
    .await
    {
        Ok(s) => s,
        Err(e) => {
            tracing::error!("Failed to create session: {e}");
            return (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({ "error": "Internal error" }))).into_response();
        }
    };

    let cookie = format!(
        "futureauth_dashboard={}; Path=/; HttpOnly; SameSite=Lax; Max-Age={}",
        session.token,
        30 * 24 * 60 * 60
    );

    (
        StatusCode::OK,
        [("set-cookie", cookie)],
        Json(serde_json::json!({ "user": developer })),
    )
        .into_response()
}

pub async fn get_session(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> impl IntoResponse {
    let cookie_header = headers.get("cookie").and_then(|v| v.to_str().ok()).unwrap_or("");
    let token = cookie_header
        .split(';')
        .filter_map(|c| c.trim().strip_prefix("futureauth_dashboard="))
        .next();

    let token = match token {
        Some(t) => t,
        None => return (StatusCode::UNAUTHORIZED, Json(serde_json::json!({ "error": "Not authenticated" }))).into_response(),
    };

    match DeveloperSession::find_by_token(&state.db, token).await {
        Ok(Some((dev, _session))) => {
            (StatusCode::OK, Json(serde_json::json!({ "user": dev }))).into_response()
        }
        _ => (StatusCode::UNAUTHORIZED, Json(serde_json::json!({ "error": "Not authenticated" }))).into_response(),
    }
}

pub async fn sign_out(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> impl IntoResponse {
    let cookie_header = headers.get("cookie").and_then(|v| v.to_str().ok()).unwrap_or("");
    if let Some(token) = cookie_header
        .split(';')
        .filter_map(|c| c.trim().strip_prefix("futureauth_dashboard="))
        .next()
    {
        let _ = DeveloperSession::delete_by_token(&state.db, token).await;
    }

    let clear = "futureauth_dashboard=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0";
    (StatusCode::OK, [("set-cookie", clear)], Json(serde_json::json!({ "ok": true })))
}

fn generate_otp(len: usize) -> String {
    let mut rng = rand::thread_rng();
    (0..len).map(|_| rng.gen_range(0..10).to_string()).collect()
}
