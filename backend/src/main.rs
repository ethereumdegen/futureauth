mod config;
mod error;
mod middleware;
mod models;
mod rate_limit;
mod routes;
mod services;

use std::sync::Arc;

use axum::{
    extract::DefaultBodyLimit,
    routing::{get, post, put, delete as delete_route},
    Router,
    response::IntoResponse,
    http::StatusCode,
};
use sqlx::postgres::PgPoolOptions;
use sqlx::PgPool;
use tower_http::cors::CorsLayer;
use axum::http::header;
use tower_http::trace::TraceLayer;
use futureauth::{FutureAuth, FutureAuthConfig};

use config::Config;
use rate_limit::RateLimiter;

#[derive(Clone)]
pub struct AppState {
    pub db: PgPool,
    pub config: Config,
    pub http: reqwest::Client,
    pub auth: Arc<FutureAuth>,
    pub otp_send_limiter: RateLimiter,
    pub otp_send_email_limiter: RateLimiter,
    pub otp_verify_limiter: RateLimiter,
}

impl AsRef<Arc<FutureAuth>> for AppState {
    fn as_ref(&self) -> &Arc<FutureAuth> {
        &self.auth
    }
}

#[tokio::main]
async fn main() {
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "info,sqlx=warn".parse().unwrap()),
        )
        .init();

    let config = Config::from_env();
    let port = config.port;

    let pool = PgPoolOptions::new()
        .max_lifetime(std::time::Duration::from_secs(30 * 60))
        .connect(&config.database_url)
        .await
        .expect("Failed to connect to database");

    // Migrations are run manually via `cargo run --bin migrate` — NOT at startup.

    // Initialize SDK handle (no table creation at startup)
    let auth = FutureAuth::new(pool.clone(), FutureAuthConfig {
        api_url: format!("http://127.0.0.1:{port}"),
        secret_key: "unused-self-hosted".to_string(),
        project_name: "FutureAuth".to_string(),
        ..Default::default()
    });

    let state = AppState {
        db: pool,
        config,
        http: reqwest::Client::new(),
        auth,
        otp_send_limiter: RateLimiter::new(5, std::time::Duration::from_secs(60)),
        otp_send_email_limiter: RateLimiter::new(10, std::time::Duration::from_secs(60)),
        otp_verify_limiter: RateLimiter::new(5, std::time::Duration::from_secs(60)),
    };

    let cors = CorsLayer::new()
        .allow_origin(
            state.config.cors_origin.parse::<axum::http::HeaderValue>().unwrap(),
        )
        .allow_methods([
            axum::http::Method::GET,
            axum::http::Method::POST,
            axum::http::Method::PUT,
            axum::http::Method::DELETE,
            axum::http::Method::OPTIONS,
        ])
        .allow_headers([
            header::CONTENT_TYPE,
            header::AUTHORIZATION,
            header::ACCEPT,
            header::COOKIE,
        ])
        .allow_credentials(true);

    let app = Router::new()
        // Dashboard auth (dogfoods SDK for verify/session/signout, custom send for direct email)
        .route("/api/auth/send-otp", post(routes::auth::send_otp))
        .route("/api/auth/verify-otp", post(routes::auth::verify_otp))
        .route("/api/auth/send-magic-link", post(routes::auth::send_magic_link))
        .route("/api/auth/verify-magic-link", post(routes::auth::verify_magic_link))
        .route("/api/auth/session", get(routes::auth::get_session))
        .route("/api/auth/sign-out", post(routes::auth::sign_out))
        // Dashboard API (requires auth)
        .route("/api/projects", get(routes::projects::list).post(routes::projects::create))
        .route(
            "/api/projects/{id}",
            get(routes::projects::get)
                .put(routes::projects::update)
                .delete(routes::projects::delete),
        )
        .route("/api/projects/{id}/regenerate-keys", post(routes::projects::regenerate_keys))
        .route("/api/projects/{id}/logs", get(routes::projects::logs))
        // Billing
        .route("/api/projects/{id}/billing", get(routes::billing::get_billing))
        .route("/api/projects/{id}/billing/checkout", post(routes::billing::create_checkout))
        .route("/api/projects/{id}/billing/portal", post(routes::billing::create_portal))
        .route("/api/webhooks/stripe", post(routes::billing::stripe_webhook))
        // Admin
        .route("/api/admin/overview", get(routes::admin::overview))
        .route("/api/admin/projects", get(routes::admin::list_projects))
        .route("/api/admin/logs", get(routes::admin::list_logs))
        .route("/api/admin/config", get(routes::admin::get_config))
        .route("/api/keys", get(routes::keys::list).post(routes::keys::create))
        .route("/api/keys/{id}", delete_route(routes::keys::delete))
        // Config
        .route("/api/config", get(get_config))
        // Machine-readable API docs (for AI agents and tooling)
        .route("/api/docs", get(api_docs))
        // OTP delivery API (called by SDK, authenticated with project secret key)
        .route("/api/v1/otp/send", post(routes::otp::send))
        // Health
        .route("/health", get(health))
        // Static dashboard files (SPA fallback)
        .fallback(serve_dashboard)
        .layer(DefaultBodyLimit::max(1024 * 64)) // 64 KB
        .layer(axum::middleware::from_fn(security_headers))
        .layer(cors)
        .layer(TraceLayer::new_for_http())
        .with_state(state);

    let listener = tokio::net::TcpListener::bind(format!("0.0.0.0:{port}"))
        .await
        .unwrap();
    tracing::info!("FutureAuth server starting on port {port}");
    axum::serve(listener, app).await.unwrap();
}

async fn health() -> impl IntoResponse {
    axum::Json(serde_json::json!({ "status": "ok", "service": "futureauth" }))
}

async fn get_config(
    axum::extract::State(state): axum::extract::State<AppState>,
) -> impl IntoResponse {
    axum::Json(serde_json::json!({
        "sms_enabled": state.config.sms_enabled(),
        "email_enabled": state.config.email_enabled(),
        "stripe_enabled": state.config.stripe_enabled(),
    }))
}

async fn api_docs(
    axum::extract::State(state): axum::extract::State<AppState>,
) -> impl IntoResponse {
    let base_url = &state.config.cors_origin;
    axum::Json(serde_json::json!({
        "openapi": "3.1.0",
        "info": {
            "title": "FutureAuth API",
            "version": "0.2.0",
            "description": "Passwordless OTP authentication for Rust apps. FutureAuth delivers verification codes via email (Resend) or SMS (Twilio) — users and sessions live in your own Postgres database.",
            "contact": {
                "url": "https://github.com/ethereumdegen/futureauth-sdk"
            }
        },
        "servers": [
            { "url": base_url, "description": "Current instance" }
        ],
        "paths": {
            "/api/v1/otp/send": {
                "post": {
                    "operationId": "sendOtp",
                    "summary": "Deliver an OTP code via email or SMS",
                    "description": "Called by the SDK to deliver a verification code. Authenticated with project secret key.",
                    "security": [{ "projectSecretKey": [] }],
                    "requestBody": {
                        "required": true,
                        "content": {
                            "application/json": {
                                "schema": {
                                    "type": "object",
                                    "required": ["channel", "destination", "code"],
                                    "properties": {
                                        "channel": { "type": "string", "enum": ["email", "sms"], "description": "Delivery channel" },
                                        "destination": { "type": "string", "description": "Email address or phone number (E.164)" },
                                        "code": { "type": "string", "description": "The OTP code to deliver" },
                                        "project_name": { "type": "string", "description": "Optional project name for branding" }
                                    }
                                }
                            }
                        }
                    },
                    "responses": {
                        "200": { "description": "OTP delivered", "content": { "application/json": { "schema": { "type": "object", "properties": { "ok": { "type": "boolean" } } } } } },
                        "400": { "description": "Invalid channel" },
                        "401": { "description": "Invalid or missing secret key" },
                        "503": { "description": "Delivery channel not configured" }
                    }
                }
            },
            "/api/projects": {
                "get": {
                    "operationId": "listProjects",
                    "summary": "List all projects for the authenticated user",
                    "security": [{ "apiKey": [] }, { "sessionCookie": [] }],
                    "responses": {
                        "200": {
                            "description": "Array of projects",
                            "content": { "application/json": { "schema": { "type": "array", "items": { "$ref": "#/components/schemas/Project" } } } }
                        },
                        "401": { "description": "Not authenticated" }
                    }
                },
                "post": {
                    "operationId": "createProject",
                    "summary": "Create a new project",
                    "security": [{ "apiKey": [] }, { "sessionCookie": [] }],
                    "requestBody": {
                        "required": true,
                        "content": {
                            "application/json": {
                                "schema": {
                                    "type": "object",
                                    "required": ["name"],
                                    "properties": {
                                        "name": { "type": "string", "description": "Project name" },
                                        "otp_mode": { "type": "string", "enum": ["email", "phone"], "default": "email", "description": "OTP delivery channel" }
                                    }
                                }
                            }
                        }
                    },
                    "responses": {
                        "201": {
                            "description": "Project created. IMPORTANT: The secret_key is only returned once — save it immediately.",
                            "content": { "application/json": { "schema": { "$ref": "#/components/schemas/ProjectWithSecret" } } }
                        },
                        "400": { "description": "Validation error" },
                        "401": { "description": "Not authenticated" }
                    }
                }
            },
            "/api/projects/{id}": {
                "get": {
                    "operationId": "getProject",
                    "summary": "Get project details",
                    "security": [{ "apiKey": [] }, { "sessionCookie": [] }],
                    "parameters": [{ "name": "id", "in": "path", "required": true, "schema": { "type": "string" } }],
                    "responses": {
                        "200": { "content": { "application/json": { "schema": { "$ref": "#/components/schemas/Project" } } } },
                        "404": { "description": "Project not found" }
                    }
                },
                "put": {
                    "operationId": "updateProject",
                    "summary": "Update a project",
                    "security": [{ "apiKey": [] }, { "sessionCookie": [] }],
                    "parameters": [{ "name": "id", "in": "path", "required": true, "schema": { "type": "string" } }],
                    "requestBody": {
                        "required": true,
                        "content": {
                            "application/json": {
                                "schema": {
                                    "type": "object",
                                    "properties": {
                                        "name": { "type": "string" },
                                        "otp_mode": { "type": "string", "enum": ["email", "phone"] }
                                    }
                                }
                            }
                        }
                    },
                    "responses": {
                        "200": { "content": { "application/json": { "schema": { "$ref": "#/components/schemas/Project" } } } },
                        "404": { "description": "Project not found" }
                    }
                },
                "delete": {
                    "operationId": "deleteProject",
                    "summary": "Delete a project",
                    "security": [{ "apiKey": [] }, { "sessionCookie": [] }],
                    "parameters": [{ "name": "id", "in": "path", "required": true, "schema": { "type": "string" } }],
                    "responses": {
                        "204": { "description": "Deleted" },
                        "404": { "description": "Project not found" }
                    }
                }
            },
            "/api/projects/{id}/regenerate-keys": {
                "post": {
                    "operationId": "regenerateProjectKeys",
                    "summary": "Regenerate the secret key for a project",
                    "security": [{ "apiKey": [] }, { "sessionCookie": [] }],
                    "parameters": [{ "name": "id", "in": "path", "required": true, "schema": { "type": "string" } }],
                    "responses": {
                        "200": {
                            "description": "New keys generated. IMPORTANT: The secret_key is only returned once.",
                            "content": { "application/json": { "schema": { "$ref": "#/components/schemas/ProjectWithSecret" } } }
                        },
                        "404": { "description": "Project not found" }
                    }
                }
            },
            "/api/keys": {
                "get": {
                    "operationId": "listApiKeys",
                    "summary": "List developer API keys",
                    "security": [{ "apiKey": [] }, { "sessionCookie": [] }],
                    "responses": {
                        "200": { "content": { "application/json": { "schema": { "type": "array", "items": { "$ref": "#/components/schemas/ApiKey" } } } } }
                    }
                },
                "post": {
                    "operationId": "createApiKey",
                    "summary": "Create a developer API key",
                    "security": [{ "apiKey": [] }, { "sessionCookie": [] }],
                    "requestBody": {
                        "required": true,
                        "content": {
                            "application/json": {
                                "schema": {
                                    "type": "object",
                                    "properties": {
                                        "name": { "type": "string", "default": "Untitled" }
                                    }
                                }
                            }
                        }
                    },
                    "responses": {
                        "201": {
                            "description": "API key created. IMPORTANT: The full key is only returned once.",
                            "content": { "application/json": { "schema": { "$ref": "#/components/schemas/ApiKeyWithSecret" } } }
                        }
                    }
                }
            },
            "/api/keys/{id}": {
                "delete": {
                    "operationId": "deleteApiKey",
                    "summary": "Delete a developer API key",
                    "security": [{ "apiKey": [] }, { "sessionCookie": [] }],
                    "parameters": [{ "name": "id", "in": "path", "required": true, "schema": { "type": "string" } }],
                    "responses": {
                        "204": { "description": "Deleted" }
                    }
                }
            },
            "/api/auth/send-otp": {
                "post": {
                    "operationId": "dashboardSendOtp",
                    "summary": "Send OTP to sign into the FutureAuth dashboard",
                    "requestBody": {
                        "required": true,
                        "content": {
                            "application/json": {
                                "schema": {
                                    "type": "object",
                                    "required": ["email"],
                                    "properties": {
                                        "email": { "type": "string", "format": "email" }
                                    }
                                }
                            }
                        }
                    },
                    "responses": {
                        "200": { "description": "OTP sent" }
                    }
                }
            },
            "/api/auth/verify-otp": {
                "post": {
                    "operationId": "dashboardVerifyOtp",
                    "summary": "Verify OTP and create a dashboard session",
                    "requestBody": {
                        "required": true,
                        "content": {
                            "application/json": {
                                "schema": {
                                    "type": "object",
                                    "required": ["email", "code"],
                                    "properties": {
                                        "email": { "type": "string", "format": "email" },
                                        "code": { "type": "string", "description": "6-character alphanumeric OTP code" }
                                    }
                                }
                            }
                        }
                    },
                    "responses": {
                        "200": { "description": "Authenticated. Sets session cookie.", "content": { "application/json": { "schema": { "type": "object", "properties": { "user": { "$ref": "#/components/schemas/User" } } } } } },
                        "400": { "description": "Invalid or expired code" }
                    }
                }
            },
            "/api/auth/session": {
                "get": {
                    "operationId": "dashboardGetSession",
                    "summary": "Get the current dashboard session",
                    "security": [{ "sessionCookie": [] }],
                    "responses": {
                        "200": { "content": { "application/json": { "schema": { "type": "object", "properties": { "user": { "$ref": "#/components/schemas/User" } } } } } },
                        "401": { "description": "Not authenticated" }
                    }
                }
            },
            "/api/auth/sign-out": {
                "post": {
                    "operationId": "dashboardSignOut",
                    "summary": "Sign out and revoke the dashboard session",
                    "security": [{ "sessionCookie": [] }],
                    "responses": {
                        "200": { "description": "Signed out. Clears session cookie." }
                    }
                }
            },
            "/api/config": {
                "get": {
                    "operationId": "getConfig",
                    "summary": "Get server configuration (which delivery channels are enabled)",
                    "responses": {
                        "200": {
                            "content": { "application/json": { "schema": { "type": "object", "properties": { "sms_enabled": { "type": "boolean" }, "email_enabled": { "type": "boolean" } } } } }
                        }
                    }
                }
            },
            "/health": {
                "get": {
                    "operationId": "healthCheck",
                    "summary": "Health check",
                    "responses": {
                        "200": { "content": { "application/json": { "schema": { "type": "object", "properties": { "status": { "type": "string", "example": "ok" }, "service": { "type": "string", "example": "futureauth" } } } } } }
                    }
                }
            }
        },
        "components": {
            "securitySchemes": {
                "projectSecretKey": {
                    "type": "http",
                    "scheme": "bearer",
                    "description": "Project secret key (vx_sec_...) — used by the SDK to deliver OTP codes"
                },
                "apiKey": {
                    "type": "http",
                    "scheme": "bearer",
                    "description": "Developer API key (vxk_...) — used to manage projects and keys programmatically"
                },
                "sessionCookie": {
                    "type": "apiKey",
                    "in": "cookie",
                    "name": "futureauth_session",
                    "description": "Dashboard session cookie — set after OTP verification"
                }
            },
            "schemas": {
                "Project": {
                    "type": "object",
                    "properties": {
                        "id": { "type": "string" },
                        "name": { "type": "string" },
                        "otp_mode": { "type": "string", "enum": ["email", "phone"] },
                        "created_at": { "type": "string", "format": "date-time" },
                        "updated_at": { "type": "string", "format": "date-time" }
                    }
                },
                "ProjectWithSecret": {
                    "type": "object",
                    "description": "Project with secret key included. The secret_key is only returned on create and regenerate — save it immediately.",
                    "properties": {
                        "id": { "type": "string" },
                        "name": { "type": "string" },
                        "otp_mode": { "type": "string", "enum": ["email", "phone"] },
                        "secret_key": { "type": "string", "description": "Secret key (vx_sec_...) — only shown once, store securely" },
                        "created_at": { "type": "string", "format": "date-time" }
                    }
                },
                "ApiKey": {
                    "type": "object",
                    "properties": {
                        "id": { "type": "string" },
                        "name": { "type": "string" },
                        "key_prefix": { "type": "string", "description": "First 12 chars of the key for identification" },
                        "created_at": { "type": "string", "format": "date-time" }
                    }
                },
                "ApiKeyWithSecret": {
                    "type": "object",
                    "description": "API key with full key included. The key is only returned on create — save it immediately.",
                    "properties": {
                        "id": { "type": "string" },
                        "name": { "type": "string" },
                        "key": { "type": "string", "description": "Full API key (vxk_...) — only shown once" },
                        "key_prefix": { "type": "string" },
                        "created_at": { "type": "string", "format": "date-time" }
                    }
                },
                "User": {
                    "type": "object",
                    "properties": {
                        "id": { "type": "string" },
                        "email": { "type": "string", "format": "email" },
                        "phone": { "type": "string" },
                        "name": { "type": "string" },
                        "email_verified": { "type": "boolean" },
                        "phone_verified": { "type": "boolean" },
                        "created_at": { "type": "string", "format": "date-time" },
                        "updated_at": { "type": "string", "format": "date-time" }
                    }
                }
            }
        }
    }))
}

async fn security_headers(
    req: axum::http::Request<axum::body::Body>,
    next: axum::middleware::Next,
) -> impl IntoResponse {
    let mut resp = next.run(req).await;
    let headers = resp.headers_mut();
    headers.insert("x-content-type-options", "nosniff".parse().unwrap());
    headers.insert("x-frame-options", "DENY".parse().unwrap());
    headers.insert(
        "strict-transport-security",
        "max-age=31536000; includeSubDomains".parse().unwrap(),
    );
    headers.insert("x-xss-protection", "1; mode=block".parse().unwrap());
    resp
}

async fn serve_dashboard(
    uri: axum::http::Uri,
) -> impl IntoResponse {
    let path = uri.path();
    let base = std::path::Path::new("./frontend/dist");

    // Try to serve static file
    if path.contains('.') {
        let requested = base.join(path.trim_start_matches('/'));
        let Ok(canonical) = requested.canonicalize() else {
            return (StatusCode::NOT_FOUND, "Not found").into_response();
        };
        let Ok(base_canonical) = base.canonicalize() else {
            return (StatusCode::NOT_FOUND, "Dashboard not built").into_response();
        };
        if !canonical.starts_with(&base_canonical) {
            return (StatusCode::FORBIDDEN, "Forbidden").into_response();
        }
        if let Ok(content) = tokio::fs::read(&canonical).await {
            let ext = path.rsplit('.').next().unwrap_or("");
            let content_type = match ext {
                "js" => "application/javascript",
                "css" => "text/css",
                "svg" => "image/svg+xml",
                "png" => "image/png",
                "ico" => "image/x-icon",
                "json" => "application/json",
                "woff" | "woff2" => "font/woff2",
                "txt" | "md" => "text/plain; charset=utf-8",
                _ => "application/octet-stream",
            };
            return (
                StatusCode::OK,
                [(axum::http::header::CONTENT_TYPE, content_type)],
                content,
            ).into_response();
        }
    }

    // SPA fallback
    match tokio::fs::read("./frontend/dist/index.html").await {
        Ok(html) => (
            StatusCode::OK,
            [(axum::http::header::CONTENT_TYPE, "text/html")],
            html,
        ).into_response(),
        Err(_) => (StatusCode::NOT_FOUND, "Dashboard not built").into_response(),
    }
}
