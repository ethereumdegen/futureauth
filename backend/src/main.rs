mod config;
mod error;
mod middleware;
mod models;
mod routes;
mod services;

use std::sync::Arc;

use axum::{
    routing::{get, post, put, delete as delete_route},
    Router,
    response::IntoResponse,
    http::StatusCode,
};
use sqlx::PgPool;
use tower_http::cors::CorsLayer;
use axum::http::header;
use tower_http::trace::TraceLayer;
use futureauth::{FutureAuth, FutureAuthConfig};

use config::Config;

#[derive(Clone)]
pub struct AppState {
    pub db: PgPool,
    pub config: Config,
    pub http: reqwest::Client,
    pub auth: Arc<FutureAuth>,
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

    let pool = PgPool::connect(&config.database_url)
        .await
        .expect("Failed to connect to database");

    // Run server-specific migrations (project, api_key tables)
    run_migrations(&pool).await;

    // Initialize SDK — creates "user", session, verification tables (dogfooding)
    let auth = FutureAuth::new(pool.clone(), FutureAuthConfig {
        api_url: format!("http://127.0.0.1:{port}"),
        secret_key: "unused-self-hosted".to_string(),
        project_name: "FutureAuth".to_string(),
        ..Default::default()
    });
    auth.ensure_tables().await.expect("Failed to create auth tables");

    let state = AppState {
        db: pool,
        config,
        http: reqwest::Client::new(),
        auth,
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
        .route("/api/keys", get(routes::keys::list).post(routes::keys::create))
        .route("/api/keys/{id}", delete_route(routes::keys::delete))
        // Config
        .route("/api/config", get(get_config))
        // OTP delivery API (called by SDK, authenticated with project secret key)
        .route("/api/v1/otp/send", post(routes::otp::send))
        // Health
        .route("/health", get(health))
        // Static dashboard files (SPA fallback)
        .fallback(serve_dashboard)
        .layer(cors)
        .layer(TraceLayer::new_for_http())
        .with_state(state);

    let listener = tokio::net::TcpListener::bind(format!("0.0.0.0:{port}"))
        .await
        .unwrap();
    tracing::info!("FutureAuth server starting on port {port}");
    axum::serve(listener, app).await.unwrap();
}

async fn run_migrations(pool: &PgPool) {
    let sql = include_str!("../migrations/001_init.sql");
    if let Err(e) = sqlx::raw_sql(sql).execute(pool).await {
        tracing::error!("Migration failed: {e}");
        std::process::exit(1);
    }
    tracing::info!("Migrations complete");
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
    }))
}

async fn serve_dashboard(
    uri: axum::http::Uri,
) -> impl IntoResponse {
    let path = uri.path();

    // Try to serve static file
    if path.contains('.') {
        let file_path = format!("./frontend/dist{path}");
        if let Ok(content) = tokio::fs::read(&file_path).await {
            let ext = path.rsplit('.').next().unwrap_or("");
            let content_type = match ext {
                "js" => "application/javascript",
                "css" => "text/css",
                "svg" => "image/svg+xml",
                "png" => "image/png",
                "ico" => "image/x-icon",
                "json" => "application/json",
                "woff" | "woff2" => "font/woff2",
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
