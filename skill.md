# FutureAuth Integration — AI Agent Reference

FutureAuth is an **OTP delivery service**. The `futureauth` Rust SDK crate handles all auth logic locally — users, sessions, and verification codes live in **your own Postgres database**. FutureAuth's server only delivers OTP codes via Resend (email) or Twilio (SMS).

## Architecture

- **FutureAuth Server**: Receives OTP delivery requests from the SDK, sends codes via Resend/Twilio. Dashboard for managing projects.
- **FutureAuth SDK** (`futureauth` crate): Installed in your Rust app. Manages users, sessions, verification codes in your local Postgres DB. Calls FutureAuth API only to deliver codes.
- **OTP modes**: `email` (via Resend) or `phone` (via Twilio SMS)
- **FutureAuth never sees your database** — all auth data stays local.

## Quick Integration (Rust/Axum)

### 1. Add dependency

```toml
# Cargo.toml
[dependencies]
futureauth = { git = "https://github.com/ethereumdegen/futureauth-sdk" }

# With Axum routes + extractor:
# futureauth = { git = "https://github.com/ethereumdegen/futureauth-sdk", features = ["axum-integration"] }
```

### 2. Initialize

```rust
use futureauth::{FutureAuth, FutureAuthConfig};
use sqlx::PgPool;

let pool = PgPool::connect(&std::env::var("DATABASE_URL")?).await?;

let futureauth = FutureAuth::new(pool.clone(), FutureAuthConfig {
    api_url: "https://future-auth.com".to_string(),
    secret_key: std::env::var("FUTUREAUTH_SECRET_KEY")?,
    project_name: "My App".to_string(),
    ..Default::default()
});

// Create auth tables (idempotent)
futureauth.ensure_tables().await?;
```

### 3. Send OTP

```rust
use futureauth::OtpChannel;

// Email OTP
futureauth.send_otp(OtpChannel::Email, "user@example.com").await?;

// Phone OTP
futureauth.send_otp(OtpChannel::Phone, "+15551234567").await?;
```

The SDK generates a random code, stores it in your `verification` table, then calls the FutureAuth API to deliver it.

### 4. Verify OTP

```rust
let (user, session) = futureauth.verify_otp(
    "user@example.com",  // or phone number
    "123456",            // code entered by user
    Some("127.0.0.1"),   // optional IP
    Some("Mozilla/5.0"), // optional user agent
).await?;

// Set cookie with session.token
// Cookie name: "futureauth_session" (configurable)
```

Auto-creates user if they don't exist. Deletes used verification code.

### 5. Validate sessions

```rust
let token = get_cookie("futureauth_session");
match futureauth.get_session(&token).await? {
    Some((user, session)) => { /* authenticated */ }
    None => { /* invalid/expired */ }
}
```

### 6. Axum integration (optional feature)

```rust
use futureauth::axum::{auth_router, AuthSession};

let app = Router::new()
    // Mounts: POST /api/auth/send-otp, POST /api/auth/verify-otp,
    //         GET /api/auth/session, POST /api/auth/sign-out
    .nest("/api/auth", auth_router())
    .route("/api/me", get(me_handler))
    .with_state(futureauth);

// AuthSession extractor validates cookie automatically
async fn me_handler(auth: AuthSession) -> Json<serde_json::Value> {
    serde_json::json!({ "id": auth.user.id, "email": auth.user.email }).into()
}
```

### 7. Sign out

```rust
futureauth.revoke_session(&token).await?;
// or revoke all: futureauth.revoke_all_sessions(&user_id).await?;
```

## Configuration

```rust
FutureAuthConfig {
    api_url: String,         // FutureAuth server URL
    secret_key: String,      // Project secret key (from dashboard)
    project_name: String,    // Shown in OTP emails/SMS
    session_ttl: Duration,   // Default: 30 days
    otp_ttl: Duration,       // Default: 10 minutes
    otp_length: usize,       // Default: 6 digits
    cookie_name: String,     // Default: "futureauth_session"
}
```

## Database Schema (created by SDK in YOUR database)

All columns are **snake_case**.

| Table | Key columns |
|---|---|
| `"user"` | id, email, phone, name, email_verified, phone_verified, image, created_at, updated_at |
| `session` | id, user_id, token, ip_address, user_agent, expires_at, created_at |
| `verification` | id, identifier, code, expires_at, created_at |

## Environment Variables

| Var | Description |
|---|---|
| `DATABASE_URL` | Your Postgres connection string |
| `FUTUREAUTH_SECRET_KEY` | Project secret key from FutureAuth dashboard |

## FutureAuth Dashboard API

Manage projects programmatically with API keys (created in dashboard Settings).

```bash
Authorization: Bearer vxk_YOUR_API_KEY

GET    /api/projects          # List projects
POST   /api/projects          # Create project { name, otp_mode }
GET    /api/projects/:id      # Get project
PUT    /api/projects/:id      # Update project
DELETE /api/projects/:id      # Delete project

GET    /api/keys              # List API keys
POST   /api/keys              # Create API key { name }
DELETE /api/keys/:id          # Delete API key
```

## Common Errors

| Error | Fix |
|---|---|
| `OtpDeliveryFailed` | Check FutureAuth project has valid Resend/Twilio creds. Verify secret key. |
| `InvalidOtp` | Wrong code or already used. Codes are single-use. |
| `OtpExpired` | Code expired (default 10 min). Resend a new one. |
| `SessionNotFound` | Token invalid or expired. Default TTL is 30 days. |
| Database errors on startup | Ensure `ensure_tables()` runs before auth operations. Check DATABASE_URL. |
