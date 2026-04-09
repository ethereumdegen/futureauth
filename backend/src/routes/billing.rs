use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::IntoResponse,
    Json,
};

use crate::error::AppError;
use crate::middleware::dashboard_auth::DashboardAuth;
use crate::models::daily_usage::DailyUsage;
use crate::models::project::Project;
use crate::models::project_plan::ProjectPlan;
use crate::AppState;

/// GET /api/projects/{id}/billing
pub async fn get_billing(
    auth: DashboardAuth,
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> Result<Json<serde_json::Value>, AppError> {
    Project::find_by_id(&state.db, &id, &auth.user_id)
        .await?
        .ok_or(AppError::NotFound)?;

    let plan = ProjectPlan::find_by_project(&state.db, &id).await?;
    let today_count = DailyUsage::get_today_count(&state.db, &id).await?;
    let daily_limit = plan.as_ref().map_or(50, |p| p.daily_limit());
    let plan_name = plan.as_ref().map_or("free", |p| p.plan.as_str());

    Ok(Json(serde_json::json!({
        "plan": plan_name,
        "usage_today": today_count,
        "daily_limit": daily_limit,
        "stripe_enabled": state.config.stripe_enabled(),
        "has_subscription": plan.as_ref().and_then(|p| p.stripe_subscription_id.as_ref()).is_some(),
    })))
}

/// POST /api/projects/{id}/billing/checkout
pub async fn create_checkout(
    auth: DashboardAuth,
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> Result<Json<serde_json::Value>, AppError> {
    let project = Project::find_by_id(&state.db, &id, &auth.user_id)
        .await?
        .ok_or(AppError::NotFound)?;

    let stripe_key = state.config.stripe_secret_key.as_ref()
        .ok_or_else(|| AppError::BadRequest("Stripe not configured".into()))?;
    let price_id = state.config.stripe_price_id.as_ref()
        .ok_or_else(|| AppError::BadRequest("Stripe price not configured".into()))?;

    let plan = ProjectPlan::find_by_project(&state.db, &id).await?;

    // Get or create Stripe customer
    let customer_id = if let Some(ref p) = plan {
        if let Some(ref cid) = p.stripe_customer_id {
            cid.clone()
        } else {
            let cid = create_stripe_customer(&state.http, stripe_key, &auth.email, &project.id).await?;
            ProjectPlan::upsert(&state.db, &id, "free", Some(&cid), None).await?;
            cid
        }
    } else {
        let cid = create_stripe_customer(&state.http, stripe_key, &auth.email, &project.id).await?;
        ProjectPlan::upsert(&state.db, &id, "free", Some(&cid), None).await?;
        cid
    };

    let return_url = format!("{}/projects/{}", state.config.cors_origin, id);
    let session_url = create_stripe_checkout_session(
        &state.http, stripe_key, &customer_id, price_id, &id, &return_url,
    ).await?;

    Ok(Json(serde_json::json!({ "url": session_url })))
}

/// POST /api/projects/{id}/billing/portal
pub async fn create_portal(
    auth: DashboardAuth,
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> Result<Json<serde_json::Value>, AppError> {
    Project::find_by_id(&state.db, &id, &auth.user_id)
        .await?
        .ok_or(AppError::NotFound)?;

    let stripe_key = state.config.stripe_secret_key.as_ref()
        .ok_or_else(|| AppError::BadRequest("Stripe not configured".into()))?;

    let plan = ProjectPlan::find_by_project(&state.db, &id)
        .await?
        .ok_or_else(|| AppError::BadRequest("No billing record found".into()))?;

    let customer_id = plan.stripe_customer_id
        .ok_or_else(|| AppError::BadRequest("No Stripe customer found".into()))?;

    let return_url = format!("{}/projects/{}", state.config.cors_origin, id);
    let portal_url = create_stripe_portal_session(
        &state.http, stripe_key, &customer_id, &return_url,
    ).await?;

    Ok(Json(serde_json::json!({ "url": portal_url })))
}

/// POST /api/webhooks/stripe
pub async fn stripe_webhook(
    State(state): State<AppState>,
    headers: axum::http::HeaderMap,
    body: axum::body::Bytes,
) -> impl IntoResponse {
    let webhook_secret = match &state.config.stripe_webhook_secret {
        Some(s) => s,
        None => return (StatusCode::SERVICE_UNAVAILABLE, "Webhook not configured").into_response(),
    };

    let sig_header = match headers.get("stripe-signature").and_then(|v| v.to_str().ok()) {
        Some(s) => s.to_string(),
        None => return (StatusCode::BAD_REQUEST, "Missing signature").into_response(),
    };

    if !verify_stripe_signature(&body, &sig_header, webhook_secret) {
        return (StatusCode::BAD_REQUEST, "Invalid signature").into_response();
    }

    let event: serde_json::Value = match serde_json::from_slice(&body) {
        Ok(v) => v,
        Err(_) => return (StatusCode::BAD_REQUEST, "Invalid JSON").into_response(),
    };

    let event_type = event["type"].as_str().unwrap_or("");
    tracing::info!("Stripe webhook: {event_type}");

    match event_type {
        "checkout.session.completed" => {
            let obj = &event["data"]["object"];
            let customer_id = obj["customer"].as_str().unwrap_or("");
            let subscription_id = obj["subscription"].as_str().unwrap_or("");
            let project_id = obj["metadata"]["project_id"].as_str().unwrap_or("");

            if !project_id.is_empty() && !customer_id.is_empty() {
                let sub_id = if subscription_id.is_empty() { None } else { Some(subscription_id) };
                if let Err(e) = ProjectPlan::upsert(
                    &state.db, project_id, "pro", Some(customer_id), sub_id,
                ).await {
                    tracing::error!("Failed to update plan on checkout: {e}");
                }
            }
        }
        "customer.subscription.updated" => {
            let obj = &event["data"]["object"];
            let subscription_id = obj["id"].as_str().unwrap_or("");
            let status = obj["status"].as_str().unwrap_or("");

            let plan = match status {
                "active" | "trialing" => "pro",
                _ => "free",
            };

            if !subscription_id.is_empty() {
                if let Err(e) = ProjectPlan::update_plan_by_subscription(
                    &state.db, subscription_id, plan,
                ).await {
                    tracing::error!("Failed to update plan on subscription change: {e}");
                }
            }
        }
        "customer.subscription.deleted" => {
            let obj = &event["data"]["object"];
            let subscription_id = obj["id"].as_str().unwrap_or("");

            if !subscription_id.is_empty() {
                if let Err(e) = ProjectPlan::update_plan_by_subscription(
                    &state.db, subscription_id, "free",
                ).await {
                    tracing::error!("Failed to downgrade plan on subscription delete: {e}");
                }
            }
        }
        _ => {}
    }

    (StatusCode::OK, "ok").into_response()
}

// --- Stripe helpers ---

async fn create_stripe_customer(
    http: &reqwest::Client,
    key: &str,
    email: &str,
    project_id: &str,
) -> Result<String, AppError> {
    let resp = http
        .post("https://api.stripe.com/v1/customers")
        .header("Authorization", format!("Bearer {key}"))
        .form(&[
            ("email", email),
            ("metadata[project_id]", project_id),
        ])
        .send()
        .await
        .map_err(|e| AppError::Internal(format!("Stripe request failed: {e}")))?;

    let body: serde_json::Value = resp.json().await
        .map_err(|e| AppError::Internal(format!("Stripe response parse failed: {e}")))?;

    body["id"].as_str()
        .map(|s| s.to_string())
        .ok_or_else(|| AppError::Internal("Stripe customer creation failed".into()))
}

async fn create_stripe_checkout_session(
    http: &reqwest::Client,
    key: &str,
    customer_id: &str,
    price_id: &str,
    project_id: &str,
    return_url: &str,
) -> Result<String, AppError> {
    let resp = http
        .post("https://api.stripe.com/v1/checkout/sessions")
        .header("Authorization", format!("Bearer {key}"))
        .form(&[
            ("customer", customer_id),
            ("mode", "subscription"),
            ("line_items[0][price]", price_id),
            ("line_items[0][quantity]", "1"),
            ("success_url", &format!("{return_url}?billing=success")),
            ("cancel_url", &format!("{return_url}?billing=cancel")),
            ("metadata[project_id]", project_id),
        ])
        .send()
        .await
        .map_err(|e| AppError::Internal(format!("Stripe request failed: {e}")))?;

    let body: serde_json::Value = resp.json().await
        .map_err(|e| AppError::Internal(format!("Stripe response parse failed: {e}")))?;

    body["url"].as_str()
        .map(|s| s.to_string())
        .ok_or_else(|| AppError::Internal("Stripe checkout session creation failed".into()))
}

async fn create_stripe_portal_session(
    http: &reqwest::Client,
    key: &str,
    customer_id: &str,
    return_url: &str,
) -> Result<String, AppError> {
    let resp = http
        .post("https://api.stripe.com/v1/billing_portal/sessions")
        .header("Authorization", format!("Bearer {key}"))
        .form(&[
            ("customer", customer_id),
            ("return_url", return_url),
        ])
        .send()
        .await
        .map_err(|e| AppError::Internal(format!("Stripe request failed: {e}")))?;

    let body: serde_json::Value = resp.json().await
        .map_err(|e| AppError::Internal(format!("Stripe response parse failed: {e}")))?;

    body["url"].as_str()
        .map(|s| s.to_string())
        .ok_or_else(|| AppError::Internal("Stripe portal session creation failed".into()))
}

/// Maximum allowed drift between the Stripe-signed timestamp and the server clock.
/// Matches Stripe's documented default tolerance.
const STRIPE_WEBHOOK_TOLERANCE_SECS: i64 = 300;

fn verify_stripe_signature(payload: &[u8], sig_header: &str, secret: &str) -> bool {
    use hmac::{Hmac, Mac};
    use sha2::Sha256;

    // Parse timestamp and any v1= signatures. Stripe may list multiple v1= entries
    // when the signing secret is being rotated.
    let mut timestamp: &str = "";
    let mut signatures: Vec<&str> = Vec::new();
    for part in sig_header.split(',') {
        let part = part.trim();
        if let Some(t) = part.strip_prefix("t=") {
            timestamp = t;
        } else if let Some(v) = part.strip_prefix("v1=") {
            signatures.push(v);
        }
    }

    if timestamp.is_empty() || signatures.is_empty() {
        return false;
    }

    // Reject events whose timestamp drifts beyond the tolerance window — this is
    // what prevents captured webhooks from being replayed later.
    let Ok(ts) = timestamp.parse::<i64>() else {
        return false;
    };
    let now = chrono::Utc::now().timestamp();
    if (now - ts).abs() > STRIPE_WEBHOOK_TOLERANCE_SECS {
        return false;
    }

    // Compute HMAC-SHA256(secret, "timestamp.payload") over the *raw* request body.
    // Using String::from_utf8_lossy here would silently corrupt non-UTF8 bytes.
    let Ok(mut mac) = Hmac::<Sha256>::new_from_slice(secret.as_bytes()) else {
        return false;
    };
    mac.update(timestamp.as_bytes());
    mac.update(b".");
    mac.update(payload);
    let computed = mac.finalize().into_bytes();

    // Constant-time compare against any listed v1 signature.
    signatures.iter().any(|sig| {
        hex::decode(sig)
            .map(|expected| {
                expected.len() == computed.len()
                    && constant_time_eq(&expected, &computed)
            })
            .unwrap_or(false)
    })
}

fn constant_time_eq(a: &[u8], b: &[u8]) -> bool {
    if a.len() != b.len() {
        return false;
    }
    let mut diff: u8 = 0;
    for (x, y) in a.iter().zip(b.iter()) {
        diff |= x ^ y;
    }
    diff == 0
}
