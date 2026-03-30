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
futureauth = { version = "0.1", features = ["axum-integration"] }
```

### 2. Initialize

```rust
use futureauth::{FutureAuth, FutureAuthConfig};
use sqlx::PgPool;
use std::sync::Arc;

let pool = PgPool::connect(&std::env::var("DATABASE_URL")?).await?;

let auth = FutureAuth::new(pool.clone(), FutureAuthConfig {
    api_url: "https://future-auth.com".to_string(),
    secret_key: std::env::var("FUTUREAUTH_SECRET_KEY")?,
    project_name: "My App".to_string(),
    ..Default::default()
});

// Create auth tables (idempotent)
auth.ensure_tables().await?;
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

> **IMPORTANT**: Use `.merge()`, NOT `.nest()`. The SDK's `auth_router()` already includes the `/api/auth/` prefix in all route paths. Using `.nest("/api/auth", ...)` would create broken double-prefixed paths like `/api/auth/api/auth/send-otp`.

```rust
use futureauth::axum::{auth_router, AuthSession};
use std::sync::Arc;

#[derive(Clone)]
struct AppState {
    db: PgPool,
    auth: Arc<FutureAuth>,
}

impl AsRef<Arc<FutureAuth>> for AppState {
    fn as_ref(&self) -> &Arc<FutureAuth> { &self.auth }
}

let state = AppState { db: pool, auth: Arc::new(auth) };

let app = Router::new()
    // MUST use .merge() — routes already have /api/auth/ prefix baked in
    .merge(futureauth::axum::auth_router(state.auth.clone()))
    .route("/api/me", get(me_handler))
    .with_state(state);

// AuthSession extractor validates cookie automatically
async fn me_handler(auth: AuthSession) -> Json<serde_json::Value> {
    serde_json::json!({ "id": auth.user.id, "email": auth.user.email }).into()
}
```

**Routes provided by `auth_router()`:**

| Method | Path | Request body | Description |
|--------|------|-------------|-------------|
| POST | `/api/auth/send-otp` | `{ "email": "user@example.com" }` or `{ "phone": "+15551234567" }` | Send OTP code |
| POST | `/api/auth/verify-otp` | `{ "email": "user@example.com", "code": "123456" }` | Verify code, create session (sets cookie) |
| GET | `/api/auth/session` | — (reads `futureauth_session` cookie) | Get current user + session |
| POST | `/api/auth/sign-out` | — (reads `futureauth_session` cookie) | Revoke current session |

### 7. Sign out

```rust
futureauth.revoke_session(&token).await?;
// or revoke all: futureauth.revoke_all_sessions(&user_id).await?;
```

## Frontend Integration (React/TypeScript)

> **CRITICAL**: Do NOT use `better-auth` or any other third-party auth client library. FutureAuth has its own route structure. You must call the FutureAuth endpoints directly.

The SDK routes do NOT follow the better-auth convention. Here are the correct endpoints and request formats:

### Auth client helper

```typescript
// src/lib/auth-client.ts
import { useState, useEffect } from "react";

const BASE_URL = window.location.origin;

export const authClient = {
  emailOtp: {
    async sendVerificationOtp({ email }: { email: string }) {
      const res = await fetch(`${BASE_URL}/api/auth/send-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to send OTP");
      }
      return res.json();
    },
    async verifyEmail({ email, otp }: { email: string; otp: string }) {
      const res = await fetch(`${BASE_URL}/api/auth/verify-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, code: otp }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        return { error: { message: data.error || "Verification failed" } };
      }
      return { data, error: null };
    },
  },
};

export async function signOut() {
  await fetch(`${BASE_URL}/api/auth/sign-out`, {
    method: "POST",
    credentials: "include",
  });
  window.location.href = "/";
}

export function useSession() {
  const [data, setData] = useState<any>(null);
  const [isPending, setIsPending] = useState(true);

  useEffect(() => {
    fetch(`${BASE_URL}/api/auth/session`, { credentials: "include" })
      .then((res) => (res.ok ? res.json() : null))
      .then((session) => { setData(session); setIsPending(false); })
      .catch(() => { setData(null); setIsPending(false); });
  }, []);

  return { data, isPending };
}
```

### Sign-in page

```tsx
// src/pages/SignIn.tsx
import { useState } from "react";
import { authClient } from "../lib/auth-client";

export default function SignIn() {
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState<"email" | "otp">("email");

  async function handleSendOTP(e: React.FormEvent) {
    e.preventDefault();
    await authClient.emailOtp.sendVerificationOtp({ email });
    setStep("otp");
  }

  async function handleVerifyOTP(e: React.FormEvent) {
    e.preventDefault();
    const result = await authClient.emailOtp.verifyEmail({ email, otp });
    if (!result.error) {
      window.location.href = "/";
    }
  }

  return step === "email" ? (
    <form onSubmit={handleSendOTP}>
      <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      <button type="submit">Send Code</button>
    </form>
  ) : (
    <form onSubmit={handleVerifyOTP}>
      <input type="text" value={otp} onChange={(e) => setOtp(e.target.value)} maxLength={6} />
      <button type="submit">Verify</button>
    </form>
  );
}
```

### App with session check

```tsx
// src/App.tsx
import { useSession, signOut } from "./lib/auth-client";

export default function App() {
  const { data: session, isPending } = useSession();

  if (isPending) return <div>Loading...</div>;
  if (!session) return <SignIn />;

  return (
    <div>
      <p>Welcome, {session.user.email}</p>
      <button onClick={() => signOut()}>Sign out</button>
    </div>
  );
}
```

### Common frontend mistakes

| Mistake | Why it fails | Fix |
|---------|-------------|-----|
| Using `better-auth` client | Routes don't match (`/email-otp/send-verification-otp` vs `/send-otp`) | Use direct fetch calls to FutureAuth endpoints |
| Calling `/api/auth/get-session` | Wrong path (404) | Use `/api/auth/session` |
| Sending `{ channel, destination }` to send-otp | Wrong body format (400) | Send `{ email: "..." }` or `{ phone: "..." }` |
| Sending `{ identifier, code }` to verify-otp | Wrong body format (400) | Send `{ email: "...", code: "..." }` or `{ phone: "...", code: "..." }` |
| Missing `credentials: "include"` on fetch | Cookie not sent/received | Always include `credentials: "include"` |

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
| `FUTUREAUTH_API_URL` | FutureAuth API URL (default: `https://future-auth.com`) |

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

## Security: Brute-Force Protection

**A 6-character alphanumeric OTP has ~2.2 billion possible values (36^6), which is much stronger than a 6-digit code.** However, without attempt limits an attacker can still make many guesses. App developers MUST add rate limiting with escalating delays on their verify endpoint.

### Recommended: iPhone-style escalating delays per identifier

| Failed attempts | Delay before next try |
|---|---|
| 1–2 | None (immediate) |
| 3 | 30 seconds |
| 4 | 60 seconds |
| 5 | 5 minutes |
| 6+ | Code invalidated — must request a new one |

### Implementation pattern

```rust
use std::collections::HashMap;
use std::sync::Arc;
use std::time::Instant;
use tokio::sync::Mutex;

#[derive(Clone)]
pub struct OtpAttemptTracker {
    state: Arc<Mutex<HashMap<String, (u32, Instant)>>>,
    max_failures: u32,
}

impl OtpAttemptTracker {
    pub fn new(max_failures: u32) -> Self {
        Self { state: Arc::new(Mutex::new(HashMap::new())), max_failures }
    }

    fn delay_secs(failures: u32) -> u64 {
        match failures { 0..=1 => 0, 2 => 30, 3 => 60, _ => 300 }
    }

    /// Ok(()) = allowed, Err(secs) = locked out, Err(0) = code should be invalidated
    pub async fn check(&self, id: &str) -> Result<(), u64> {
        let state = self.state.lock().await;
        let Some(&(failures, last)) = state.get(id) else { return Ok(()) };
        if failures >= self.max_failures { return Err(0) }
        let delay = Self::delay_secs(failures);
        if delay == 0 { return Ok(()) }
        let elapsed = last.elapsed().as_secs();
        if elapsed >= delay { Ok(()) } else { Err(delay - elapsed) }
    }

    pub async fn record_failure(&self, id: &str) {
        let mut state = self.state.lock().await;
        let entry = state.entry(id.to_string()).or_insert((0, Instant::now()));
        entry.0 += 1;
        entry.1 = Instant::now();
    }

    pub async fn clear(&self, id: &str) {
        self.state.lock().await.remove(id);
    }
}
```

**Key rules:**
- Check attempts BEFORE calling `verify_otp()`
- On failure: `tracker.record_failure(&email)`
- On success: `tracker.clear(&email)`
- On new code sent: `tracker.clear(&email)` (reset attempts for fresh code)
- Return `retry_after` seconds in 429 response so frontend can show countdown
- Also add per-IP rate limiting (e.g., 5 verify requests/minute) as a separate layer

## Common Errors

| Error | Fix |
|---|---|
| `OtpDeliveryFailed` | Check FutureAuth project has valid Resend/Twilio creds. Verify secret key. |
| `InvalidOtp` | Wrong code or already used. Codes are single-use. |
| `OtpExpired` | Code expired (default 2 min). Resend a new one. |
| `SessionNotFound` | Token invalid or expired. Default TTL is 30 days. |
| Database errors on startup | Ensure `ensure_tables()` runs before auth operations. Check DATABASE_URL. |
| 404 on `/api/auth/get-session` | Wrong path. The correct path is `/api/auth/session`. |
| 405 on auth routes | You are probably using `.nest()` instead of `.merge()`. The auth_router routes already include `/api/auth/` prefix. |
