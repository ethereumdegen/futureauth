import { Link } from 'react-router'
import { ArrowLeft, Shield, Copy, Check, BookOpen, Terminal, Database, Zap, Package, Rocket } from 'lucide-react'
import { useState } from 'react'

export default function Docs() {
  const [copied, setCopied] = useState('')
  const futureauthUrl = window.location.origin

  function copy(text: string, label: string) {
    navigator.clipboard.writeText(text)
    setCopied(label)
    setTimeout(() => setCopied(''), 2000)
  }

  return (
    <div className="min-h-screen bg-white">
      <nav className="border-b border-gray-200 sticky top-0 bg-white/80 backdrop-blur-xl z-10">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center gap-3">
          <Link to="/" className="text-gray-400 hover:text-gray-900 transition-colors">
            <ArrowLeft size={16} />
          </Link>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-emerald-600 rounded-lg flex items-center justify-center">
              <Shield size={14} className="text-white" />
            </div>
            <span className="text-lg font-bold text-gray-900">FutureAuth</span>
          </div>
          <span className="text-gray-300">/</span>
          <span className="text-sm text-gray-500 font-medium">Documentation</span>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-6 py-10 flex gap-12">
        {/* Sidebar */}
        <aside className="hidden lg:block w-56 shrink-0 sticky top-20 self-start">
          <nav className="space-y-1 text-sm">
            <SidebarGroup title="Getting Started">
              <SidebarLink href="#overview">Overview</SidebarLink>
              <SidebarLink href="#architecture">Architecture</SidebarLink>
              <SidebarLink href="#installation">Installation</SidebarLink>
              <SidebarLink href="#quick-start">Quick Start</SidebarLink>
            </SidebarGroup>
            <SidebarGroup title="Core Concepts">
              <SidebarLink href="#configuration">Configuration</SidebarLink>
              <SidebarLink href="#send-otp">Sending OTP</SidebarLink>
              <SidebarLink href="#verify-otp">Verifying OTP</SidebarLink>
              <SidebarLink href="#sessions">Sessions</SidebarLink>
              <SidebarLink href="#sign-out">Sign Out</SidebarLink>
            </SidebarGroup>
            <SidebarGroup title="Axum Integration">
              <SidebarLink href="#axum-setup">Setup</SidebarLink>
              <SidebarLink href="#axum-routes">Auth Routes</SidebarLink>
              <SidebarLink href="#axum-extractor">AuthSession Extractor</SidebarLink>
              <SidebarLink href="#axum-state">AppState Pattern</SidebarLink>
            </SidebarGroup>
            <SidebarGroup title="Frontend">
              <SidebarLink href="#frontend-client">Auth Client</SidebarLink>
              <SidebarLink href="#frontend-session">Session Hook</SidebarLink>
              <SidebarLink href="#frontend-mistakes">Common Mistakes</SidebarLink>
            </SidebarGroup>
            <SidebarGroup title="Reference">
              <SidebarLink href="#schema">Database Schema</SidebarLink>
              <SidebarLink href="#api-reference">SDK API Reference</SidebarLink>
              <SidebarLink href="#rest-api">REST API Endpoints</SidebarLink>
              <SidebarLink href="#dashboard-api">Dashboard API</SidebarLink>
              <SidebarLink href="#errors">Error Handling</SidebarLink>
              <SidebarLink href="#troubleshooting">Troubleshooting</SidebarLink>
            </SidebarGroup>
          </nav>
        </aside>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">FutureAuth Documentation</h1>
          <p className="text-gray-500 mb-10">
            Passwordless OTP authentication for Rust apps. Email and SMS.{' '}
            <a href="https://crates.io/crates/futureauth" target="_blank" rel="noopener" className="text-emerald-600 underline">crates.io/crates/futureauth</a>
            {' | '}
            <a href="https://github.com/ethereumdegen/future-auth-sample-project" target="_blank" rel="noopener" className="text-emerald-600 underline">Sample Project</a>
          </p>

          {/* Overview */}
          <Section id="overview" title="Overview">
            <p>
              <strong>FutureAuth</strong> is a two-part system for adding passwordless OTP authentication to Rust applications:
            </p>
            <ol className="list-decimal list-inside space-y-2 mt-3 text-gray-600">
              <li><strong>The SDK</strong> (<code className="code-inline">futureauth</code> crate) — runs inside your app, manages users, sessions, and verification codes in <em>your own Postgres database</em></li>
              <li><strong>The API</strong> (future-auth.com) — a hosted service that delivers OTP codes via email (Resend) or SMS (Twilio)</li>
            </ol>
            <p className="mt-3">
              FutureAuth never stores your users or sessions. It only delivers the 6-digit code. Everything else happens locally in your database.
            </p>
            <Callout type="info">
              Think of FutureAuth like Stripe for auth codes — you own the users, we deliver the codes.
            </Callout>
          </Section>

          {/* Architecture */}
          <Section id="architecture" title="Architecture">
            <p>Here's how the pieces fit together:</p>
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-6 mt-4 font-mono text-sm text-gray-600 leading-loose">
              <pre>{`┌─────────────────────────────────────────────┐
│  Your Rust App                              │
│                                             │
│  ┌──────────────────────────┐               │
│  │  futureauth SDK          │               │
│  │                          │               │
│  │  send_otp()  ──────────────────►  FutureAuth API
│  │  verify_otp()            │        (future-auth.com)
│  │  get_session()           │        Delivers email/SMS
│  │  revoke_session()        │               │
│  │                          │               │
│  │  ┌────────────────────┐  │               │
│  │  │  Your Postgres DB  │  │               │
│  │  │  - "user" table    │  │               │
│  │  │  - session table   │  │               │
│  │  │  - verification    │  │               │
│  │  └────────────────────┘  │               │
│  └──────────────────────────┘               │
└─────────────────────────────────────────────┘`}</pre>
            </div>
            <ul className="mt-4 space-y-1 text-sm text-gray-600">
              <li><code className="code-inline">send_otp()</code> — generates a code, stores it locally, then calls FutureAuth API to deliver it</li>
              <li><code className="code-inline">verify_otp()</code> — checks the code locally, creates user + session in your DB</li>
              <li><code className="code-inline">get_session()</code> — validates a session token locally (no network call)</li>
              <li><code className="code-inline">revoke_session()</code> — deletes a session locally (no network call)</li>
            </ul>
          </Section>

          {/* Installation */}
          <Section id="installation" title="Installation">
            <p>Add the SDK to your project:</p>
            <CodeBlock
              label="terminal"
              code="cargo add futureauth"
              copied={copied}
              onCopy={copy}
            />
            <p className="mt-3">For the Axum integration (pre-built routes + auth extractor):</p>
            <CodeBlock
              label="terminal"
              code='cargo add futureauth --features axum-integration'
              copied={copied}
              onCopy={copy}
            />
            <p className="mt-3">Or add it directly to your <code className="code-inline">Cargo.toml</code>:</p>
            <CodeBlock
              label="Cargo.toml"
              code={`[dependencies]
futureauth = { version = "0.1", features = ["axum-integration"] }`}
              copied={copied}
              onCopy={copy}
            />
            <Callout type="info">
              The <code className="text-xs">axum-integration</code> feature is optional. Without it, you get the core SDK (send_otp, verify_otp, sessions) that works with any Rust framework.
            </Callout>
          </Section>

          {/* Quick Start */}
          <Section id="quick-start" title="Quick Start">
            <p>A complete example — from zero to authenticated routes in under 30 lines:</p>
            <CodeBlock
              label="src/main.rs"
              code={`use futureauth::{FutureAuth, FutureAuthConfig};
use futureauth::axum::{auth_router, AuthSession};
use axum::{Router, routing::get, Json};
use sqlx::PgPool;
use std::sync::Arc;

#[derive(Clone)]
struct AppState {
    auth: Arc<FutureAuth>,
}

// Required for AuthSession extractor
impl AsRef<Arc<FutureAuth>> for AppState {
    fn as_ref(&self) -> &Arc<FutureAuth> { &self.auth }
}

#[tokio::main]
async fn main() {
    let pool = PgPool::connect(&std::env::var("DATABASE_URL").unwrap()).await.unwrap();

    let auth = FutureAuth::new(pool.clone(), FutureAuthConfig {
        api_url: "${futureauthUrl}".into(),
        secret_key: std::env::var("FUTUREAUTH_SECRET_KEY").unwrap(),
        project_name: "My App".into(),
        ..Default::default()
    });
    auth.ensure_tables().await.unwrap();

    let state = AppState { auth: Arc::new(auth) };

    let app = Router::new()
        // IMPORTANT: use .merge() — routes already include /api/auth/ prefix
        .merge(futureauth::axum::auth_router(state.auth.clone()))
        .route("/api/me", get(me))
        .with_state(state);

    let listener = tokio::net::TcpListener::bind("0.0.0.0:3000").await.unwrap();
    axum::serve(listener, app).await.unwrap();
}

async fn me(auth: AuthSession) -> Json<serde_json::Value> {
    Json(serde_json::json!({
        "id": auth.user.id,
        "email": auth.user.email,
    }))
}`}
              copied={copied}
              onCopy={copy}
            />
            <p className="text-sm text-gray-500 mt-3">
              This gives you four auth endpoints and a protected route, all backed by your own Postgres.
            </p>
          </Section>

          {/* Configuration */}
          <Section id="configuration" title="Configuration">
            <p>The <code className="code-inline">FutureAuthConfig</code> struct controls all SDK behavior:</p>
            <CodeBlock
              label="Configuration options"
              code={`FutureAuthConfig {
    // Required
    api_url: String,         // FutureAuth API URL (e.g. "https://future-auth.com")
    secret_key: String,      // Your project's secret key from the dashboard

    // Optional (shown with defaults)
    project_name: String,    // "My App" — shown in OTP emails/SMS
    session_ttl: Duration,   // 30 days — how long sessions last
    otp_ttl: Duration,       // 10 minutes — how long OTP codes are valid
    otp_length: usize,       // 6 — number of digits in OTP codes
    cookie_name: String,     // "futureauth_session" — cookie name for session token
}`}
              copied={copied}
              onCopy={copy}
            />
            <h4 className="font-semibold text-gray-900 mt-6 mb-2">Environment variables</h4>
            <CodeBlock
              label=".env"
              code={`DATABASE_URL=postgres://user:pass@host:5432/mydb
FUTUREAUTH_SECRET_KEY=vx_sec_xxxxxxxxxxxx`}
              copied={copied}
              onCopy={copy}
            />
            <Callout type="warn">
              Save your secret key when you create a project — it's only shown once. If you lose it, delete the project and create a new one.
            </Callout>
          </Section>

          {/* Send OTP */}
          <Section id="send-otp" title="Sending OTP">
            <p>
              <code className="code-inline">send_otp()</code> generates a random code, stores it in your database's <code className="code-inline">verification</code> table,
              then calls the FutureAuth API to deliver it via email or SMS.
            </p>
            <Tabs
              tabs={[
                {
                  label: 'Email',
                  content: (
                    <CodeBlock
                      label="Send email OTP"
                      code={`use futureauth::OtpChannel;

// Send a 6-digit code to the user's email via Resend
auth.send_otp(OtpChannel::Email, "user@example.com").await?;`}
                      copied={copied}
                      onCopy={copy}
                    />
                  ),
                },
                {
                  label: 'SMS',
                  content: (
                    <CodeBlock
                      label="Send SMS OTP"
                      code={`use futureauth::OtpChannel;

// Send a 6-digit code to the user's phone via Twilio
auth.send_otp(OtpChannel::Phone, "+15551234567").await?;`}
                      copied={copied}
                      onCopy={copy}
                    />
                  ),
                },
              ]}
            />
            <h4 className="font-semibold text-gray-900 mt-4 mb-2">What happens internally</h4>
            <ol className="list-decimal list-inside space-y-1 text-sm text-gray-600">
              <li>Any existing codes for this identifier are deleted</li>
              <li>A new random code is generated (default: 6 digits)</li>
              <li>The code is stored in the <code className="code-inline">verification</code> table with an expiry time</li>
              <li>The FutureAuth API is called to deliver the code via the appropriate channel</li>
            </ol>
            <Callout type="info">
              Codes are single-use. Sending a new code invalidates any previous unused code for the same identifier.
            </Callout>
          </Section>

          {/* Verify OTP */}
          <Section id="verify-otp" title="Verifying OTP">
            <p>
              <code className="code-inline">verify_otp()</code> checks the code against the <code className="code-inline">verification</code> table, creates or finds the user,
              and creates a new session — all locally in your database.
            </p>
            <CodeBlock
              label="Verify OTP and create session"
              code={`let (user, session) = auth.verify_otp(
    "user@example.com",  // the identifier (email or phone)
    "123456",            // the code the user entered
    Some("127.0.0.1"),   // optional: client IP address
    Some("Mozilla/5.0"), // optional: client user agent
).await?;

// user.id        — unique user ID
// user.email     — the verified email address
// session.token  — opaque session token (set this as a cookie)`}
              copied={copied}
              onCopy={copy}
            />
            <h4 className="font-semibold text-gray-900 mt-4 mb-2">What happens internally</h4>
            <ol className="list-decimal list-inside space-y-1 text-sm text-gray-600">
              <li>Looks up the code in the <code className="code-inline">verification</code> table</li>
              <li>Checks if the code is expired (default: 10 minutes)</li>
              <li>Deletes the code (single-use)</li>
              <li>Finds or creates the user by email/phone</li>
              <li>Marks the email/phone as verified on the user record</li>
              <li>Creates a new session with a random opaque token</li>
              <li>Returns the <code className="code-inline">(User, Session)</code> tuple</li>
            </ol>
            <Callout type="info">
              If the user doesn't exist, <code className="text-xs">verify_otp()</code> auto-creates them. This is a combined sign-up and sign-in flow.
            </Callout>
          </Section>

          {/* Sessions */}
          <Section id="sessions" title="Sessions">
            <p>
              Sessions are opaque tokens stored in the <code className="code-inline">session</code> table. Validate them with <code className="code-inline">get_session()</code>:
            </p>
            <CodeBlock
              label="Session validation"
              code={`// Validate a session token (e.g., from a cookie)
match auth.get_session("session_token_here").await? {
    Some((user, session)) => {
        // Authenticated
        println!("User: {} ({})", user.id, user.email.unwrap_or_default());
        println!("Session expires: {}", session.expires_at);
    }
    None => {
        // Invalid or expired
    }
}`}
              copied={copied}
              onCopy={copy}
            />
            <h4 className="font-semibold text-gray-900 mt-4 mb-2">Session properties</h4>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border border-gray-200 rounded-lg overflow-hidden">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left px-4 py-2 font-medium text-gray-700">Field</th>
                    <th className="text-left px-4 py-2 font-medium text-gray-700">Type</th>
                    <th className="text-left px-4 py-2 font-medium text-gray-700">Description</th>
                  </tr>
                </thead>
                <tbody className="text-gray-600">
                  <tr className="border-t"><td className="px-4 py-2 font-mono text-xs">id</td><td className="px-4 py-2">String</td><td className="px-4 py-2">Unique session ID</td></tr>
                  <tr className="border-t"><td className="px-4 py-2 font-mono text-xs">user_id</td><td className="px-4 py-2">String</td><td className="px-4 py-2">References the user</td></tr>
                  <tr className="border-t"><td className="px-4 py-2 font-mono text-xs">token</td><td className="px-4 py-2">String</td><td className="px-4 py-2">Opaque session token (stored in cookie)</td></tr>
                  <tr className="border-t"><td className="px-4 py-2 font-mono text-xs">ip_address</td><td className="px-4 py-2">Option&lt;String&gt;</td><td className="px-4 py-2">Client IP (set on creation)</td></tr>
                  <tr className="border-t"><td className="px-4 py-2 font-mono text-xs">user_agent</td><td className="px-4 py-2">Option&lt;String&gt;</td><td className="px-4 py-2">Client user agent (set on creation)</td></tr>
                  <tr className="border-t"><td className="px-4 py-2 font-mono text-xs">expires_at</td><td className="px-4 py-2">DateTime&lt;Utc&gt;</td><td className="px-4 py-2">When the session expires (default: 30 days from creation)</td></tr>
                  <tr className="border-t"><td className="px-4 py-2 font-mono text-xs">created_at</td><td className="px-4 py-2">DateTime&lt;Utc&gt;</td><td className="px-4 py-2">When the session was created</td></tr>
                </tbody>
              </table>
            </div>
          </Section>

          {/* Sign Out */}
          <Section id="sign-out" title="Sign Out">
            <CodeBlock
              label="Revoke sessions"
              code={`// Revoke a specific session
auth.revoke_session("session_token_here").await?;

// Revoke ALL sessions for a user (e.g., "sign out everywhere")
auth.revoke_all_sessions("user_id_here").await?;`}
              copied={copied}
              onCopy={copy}
            />
          </Section>

          {/* Axum Setup */}
          <Section id="axum-setup" title="Axum Integration — Setup">
            <p>
              The <code className="code-inline">axum-integration</code> feature provides pre-built routes and an <code className="code-inline">AuthSession</code> extractor.
            </p>
            <CodeBlock
              label="Cargo.toml"
              code={`[dependencies]
futureauth = { version = "0.1", features = ["axum-integration"] }`}
              copied={copied}
              onCopy={copy}
            />
            <p className="mt-3">
              Your Axum state must implement <code className="code-inline">AsRef&lt;Arc&lt;FutureAuth&gt;&gt;</code>:
            </p>
            <CodeBlock
              label="AppState"
              code={`use std::sync::Arc;
use futureauth::FutureAuth;

#[derive(Clone)]
struct AppState {
    db: PgPool,
    auth: Arc<FutureAuth>,
    // ... your other fields
}

impl AsRef<Arc<FutureAuth>> for AppState {
    fn as_ref(&self) -> &Arc<FutureAuth> {
        &self.auth
    }
}`}
              copied={copied}
              onCopy={copy}
            />
          </Section>

          {/* Axum Routes */}
          <Section id="axum-routes" title="Axum Integration — Auth Routes">
            <p>Mount the built-in auth router to get all four auth endpoints:</p>
            <Callout type="warn">
              Use <code className="text-xs">.merge()</code>, NOT <code className="text-xs">.nest()</code>. The routes already include the <code className="text-xs">/api/auth/</code> prefix.
              Using <code className="text-xs">{`.nest("/api/auth", ...)`}</code> would create broken double-prefixed paths like <code className="text-xs">/api/auth/api/auth/send-otp</code>.
            </Callout>
            <CodeBlock
              label="Router setup"
              code={`use futureauth::axum::auth_router;

let app = Router::new()
    // MUST use .merge() — routes already have /api/auth/ prefix
    .merge(futureauth::axum::auth_router(state.auth.clone()))
    .with_state(state);`}
              copied={copied}
              onCopy={copy}
            />
            <h4 className="font-semibold text-gray-900 mt-4 mb-2">Endpoints provided</h4>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border border-gray-200 rounded-lg overflow-hidden">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left px-4 py-2 font-medium text-gray-700">Method</th>
                    <th className="text-left px-4 py-2 font-medium text-gray-700">Path</th>
                    <th className="text-left px-4 py-2 font-medium text-gray-700">Description</th>
                  </tr>
                </thead>
                <tbody className="text-gray-600">
                  <tr className="border-t"><td className="px-4 py-2 font-mono text-xs">POST</td><td className="px-4 py-2 font-mono text-xs">/api/auth/send-otp</td><td className="px-4 py-2">Send a verification code</td></tr>
                  <tr className="border-t"><td className="px-4 py-2 font-mono text-xs">POST</td><td className="px-4 py-2 font-mono text-xs">/api/auth/verify-otp</td><td className="px-4 py-2">Verify code, create session</td></tr>
                  <tr className="border-t"><td className="px-4 py-2 font-mono text-xs">GET</td><td className="px-4 py-2 font-mono text-xs">/api/auth/session</td><td className="px-4 py-2">Get current user + session</td></tr>
                  <tr className="border-t"><td className="px-4 py-2 font-mono text-xs">POST</td><td className="px-4 py-2 font-mono text-xs">/api/auth/sign-out</td><td className="px-4 py-2">Revoke current session</td></tr>
                </tbody>
              </table>
            </div>

            <h4 className="font-semibold text-gray-900 mt-6 mb-2">Request/Response formats</h4>
            <CodeBlock
              label="POST /api/auth/send-otp"
              code={`// Request — pass email OR phone (not both)
{ "email": "user@example.com" }
// or for SMS:
{ "phone": "+15551234567" }

// Response (200 OK)
{ "ok": true }`}
              copied={copied}
              onCopy={copy}
            />
            <CodeBlock
              label="POST /api/auth/verify-otp"
              code={`// Request — pass email OR phone (must match what was used with send-otp)
{ "email": "user@example.com", "code": "123456" }
// or for SMS:
{ "phone": "+15551234567", "code": "123456" }

// Response (200 OK) — also sets futureauth_session cookie
{ "user": { "id": "abc123", "email": "user@example.com", ... } }`}
              copied={copied}
              onCopy={copy}
            />
            <CodeBlock
              label="GET /api/auth/session"
              code={`// Requires futureauth_session cookie (sent automatically with credentials: "include")
// Response (200 OK)
{
  "user": { "id": "abc123", "email": "user@example.com", ... },
  "session": { "expires_at": "2026-04-28T..." }
}

// Response (401) if no valid session
{ "error": "Not authenticated" }`}
              copied={copied}
              onCopy={copy}
            />
          </Section>

          {/* Axum Extractor */}
          <Section id="axum-extractor" title="Axum Integration — AuthSession Extractor">
            <p>
              Use <code className="code-inline">AuthSession</code> as a handler parameter to require authentication:
            </p>
            <CodeBlock
              label="Protected route"
              code={`use futureauth::axum::AuthSession;

async fn protected_handler(auth: AuthSession) -> Json<serde_json::Value> {
    // auth.user  — the authenticated User
    // auth.session — the current Session

    Json(serde_json::json!({
        "user_id": auth.user.id,
        "email": auth.user.email,
        "phone": auth.user.phone,
        "session_expires": auth.session.expires_at,
    }))
}

// Returns 401 automatically if no valid session cookie is present`}
              copied={copied}
              onCopy={copy}
            />
          </Section>

          {/* AppState Pattern */}
          <Section id="axum-state" title="Axum Integration — AppState Pattern">
            <p>
              If your app has other state (database pool, config, etc.), wrap FutureAuth in your state struct:
            </p>
            <CodeBlock
              label="Full AppState example"
              code={`use std::sync::Arc;
use futureauth::FutureAuth;
use sqlx::PgPool;

#[derive(Clone)]
struct AppState {
    db: PgPool,
    auth: Arc<FutureAuth>,
    config: AppConfig,
}

impl AsRef<Arc<FutureAuth>> for AppState {
    fn as_ref(&self) -> &Arc<FutureAuth> { &self.auth }
}

// Now both auth_router() and AuthSession work with your state
let app = Router::new()
    .merge(futureauth::axum::auth_router(state.auth.clone()))
    .route("/api/me", get(me))
    .route("/api/data", get(data))
    .with_state(state);

async fn me(auth: AuthSession) -> impl IntoResponse { ... }
async fn data(
    auth: AuthSession,
    State(state): State<AppState>,
) -> impl IntoResponse {
    // Access both auth and your custom state
    let rows = sqlx::query("SELECT * FROM items WHERE owner = $1")
        .bind(&auth.user.id)
        .fetch_all(&state.db)
        .await?;
    // ...
}`}
              copied={copied}
              onCopy={copy}
            />
          </Section>

          {/* Frontend Client */}
          <Section id="frontend-client" title="Frontend — Auth Client">
            <Callout type="warn">
              Do NOT use <code className="text-xs">better-auth</code> or any other third-party auth client. FutureAuth has its own route structure.
              Using the wrong client will cause 404/405 errors because the paths don't match.
            </Callout>
            <p className="mt-3">
              Call the FutureAuth endpoints directly with <code className="code-inline">fetch</code>. Here's a ready-to-use auth client:
            </p>
            <CodeBlock
              label="src/lib/auth-client.ts"
              code={`import { useState, useEffect } from "react";

const BASE_URL = window.location.origin;

export const authClient = {
  emailOtp: {
    async sendVerificationOtp({ email }: { email: string }) {
      const res = await fetch(\`\${BASE_URL}/api/auth/send-otp\`, {
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
      const res = await fetch(\`\${BASE_URL}/api/auth/verify-otp\`, {
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
  await fetch(\`\${BASE_URL}/api/auth/sign-out\`, {
    method: "POST",
    credentials: "include",
  });
  window.location.href = "/";
}`}
              copied={copied}
              onCopy={copy}
            />
            <Callout type="info">
              Always use <code className="text-xs">credentials: "include"</code> on every fetch call so the <code className="text-xs">futureauth_session</code> cookie is sent and received correctly.
            </Callout>
          </Section>

          {/* Frontend Session */}
          <Section id="frontend-session" title="Frontend — Session Hook">
            <p>A React hook that checks the session on mount:</p>
            <CodeBlock
              label="useSession hook (add to auth-client.ts)"
              code={`export function useSession() {
  const [data, setData] = useState<any>(null);
  const [isPending, setIsPending] = useState(true);

  useEffect(() => {
    fetch(\`\${BASE_URL}/api/auth/session\`, { credentials: "include" })
      .then((res) => (res.ok ? res.json() : null))
      .then((session) => { setData(session); setIsPending(false); })
      .catch(() => { setData(null); setIsPending(false); });
  }, []);

  return { data, isPending };
}`}
              copied={copied}
              onCopy={copy}
            />
            <p className="mt-2">Usage in your app:</p>
            <CodeBlock
              label="src/App.tsx"
              code={`import { useSession, signOut } from "./lib/auth-client";

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
}`}
              copied={copied}
              onCopy={copy}
            />
          </Section>

          {/* Frontend Common Mistakes */}
          <Section id="frontend-mistakes" title="Frontend — Common Mistakes">
            <div className="overflow-x-auto">
              <table className="w-full text-sm border border-gray-200 rounded-lg overflow-hidden">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left px-4 py-2 font-medium text-gray-700">Mistake</th>
                    <th className="text-left px-4 py-2 font-medium text-gray-700">Why it fails</th>
                    <th className="text-left px-4 py-2 font-medium text-gray-700">Fix</th>
                  </tr>
                </thead>
                <tbody className="text-gray-600">
                  <tr className="border-t">
                    <td className="px-4 py-2">Using <code className="code-inline">better-auth</code> client</td>
                    <td className="px-4 py-2">Routes don't match (e.g. <code className="code-inline">/email-otp/send-verification-otp</code> vs <code className="code-inline">/send-otp</code>)</td>
                    <td className="px-4 py-2">Use direct fetch calls to FutureAuth endpoints</td>
                  </tr>
                  <tr className="border-t">
                    <td className="px-4 py-2">Calling <code className="code-inline">/api/auth/get-session</code></td>
                    <td className="px-4 py-2">Wrong path — returns 404</td>
                    <td className="px-4 py-2">Use <code className="code-inline">/api/auth/session</code></td>
                  </tr>
                  <tr className="border-t">
                    <td className="px-4 py-2">Sending <code className="code-inline">{`{ channel, destination }`}</code></td>
                    <td className="px-4 py-2">Wrong body format — returns 400</td>
                    <td className="px-4 py-2">Send <code className="code-inline">{`{ email: "..." }`}</code> or <code className="code-inline">{`{ phone: "..." }`}</code></td>
                  </tr>
                  <tr className="border-t">
                    <td className="px-4 py-2">Missing <code className="code-inline">credentials: "include"</code></td>
                    <td className="px-4 py-2">Cookie not sent/received</td>
                    <td className="px-4 py-2">Always include on every fetch call</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </Section>

          {/* Schema */}
          <Section id="schema" title="Database Schema">
            <p>
              The SDK creates three tables in your database via <code className="code-inline">ensure_tables()</code>.
              All columns use <strong>snake_case</strong>. Tables are created with <code className="code-inline">IF NOT EXISTS</code> — safe to call on every startup.
            </p>
            <CodeBlock
              label="user table"
              code={`CREATE TABLE IF NOT EXISTS "user" (
    id              TEXT PRIMARY KEY,
    email           TEXT UNIQUE,
    phone           TEXT UNIQUE,
    name            TEXT,
    email_verified  BOOLEAN NOT NULL DEFAULT FALSE,
    phone_verified  BOOLEAN NOT NULL DEFAULT FALSE,
    image           TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);`}
              copied={copied}
              onCopy={copy}
            />
            <CodeBlock
              label="session table"
              code={`CREATE TABLE IF NOT EXISTS session (
    id          TEXT PRIMARY KEY,
    user_id     TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
    token       TEXT NOT NULL UNIQUE,
    ip_address  TEXT,
    user_agent  TEXT,
    expires_at  TIMESTAMPTZ NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);`}
              copied={copied}
              onCopy={copy}
            />
            <CodeBlock
              label="verification table"
              code={`CREATE TABLE IF NOT EXISTS verification (
    id          TEXT PRIMARY KEY,
    identifier  TEXT NOT NULL,
    code        TEXT NOT NULL,
    expires_at  TIMESTAMPTZ NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);`}
              copied={copied}
              onCopy={copy}
            />
          </Section>

          {/* API Reference */}
          <Section id="api-reference" title="SDK API Reference">
            <h4 className="font-semibold text-gray-900 mb-2 font-mono text-sm">FutureAuth::new(pool, config)</h4>
            <p className="text-sm text-gray-600 mb-4">Create a new FutureAuth instance. Does not create tables — call <code className="code-inline">ensure_tables()</code> separately.</p>

            <h4 className="font-semibold text-gray-900 mb-2 font-mono text-sm">ensure_tables() -&gt; Result&lt;()&gt;</h4>
            <p className="text-sm text-gray-600 mb-4">Creates the <code className="code-inline">user</code>, <code className="code-inline">session</code>, and <code className="code-inline">verification</code> tables if they don't exist. Idempotent.</p>

            <h4 className="font-semibold text-gray-900 mb-2 font-mono text-sm">send_otp(channel, destination) -&gt; Result&lt;()&gt;</h4>
            <p className="text-sm text-gray-600 mb-1">Generate and deliver an OTP code.</p>
            <ul className="text-sm text-gray-500 list-disc list-inside mb-4">
              <li><code className="code-inline">channel</code> — <code className="code-inline">OtpChannel::Email</code> or <code className="code-inline">OtpChannel::Phone</code></li>
              <li><code className="code-inline">destination</code> — email address or phone number (E.164 format for SMS)</li>
            </ul>

            <h4 className="font-semibold text-gray-900 mb-2 font-mono text-sm">verify_otp(identifier, code, ip, user_agent) -&gt; Result&lt;(User, Session)&gt;</h4>
            <p className="text-sm text-gray-600 mb-1">Verify a code and create a session. Auto-creates the user if they don't exist.</p>
            <ul className="text-sm text-gray-500 list-disc list-inside mb-4">
              <li><code className="code-inline">identifier</code> — the email or phone that was used with <code className="code-inline">send_otp()</code></li>
              <li><code className="code-inline">code</code> — the 6-digit code the user entered</li>
              <li><code className="code-inline">ip</code> — optional client IP address (stored on session)</li>
              <li><code className="code-inline">user_agent</code> — optional client user agent (stored on session)</li>
            </ul>

            <h4 className="font-semibold text-gray-900 mb-2 font-mono text-sm">get_session(token) -&gt; Result&lt;Option&lt;(User, Session)&gt;&gt;</h4>
            <p className="text-sm text-gray-600 mb-4">Validate a session token. Returns <code className="code-inline">None</code> if the token is invalid or expired. No network call — fully local.</p>

            <h4 className="font-semibold text-gray-900 mb-2 font-mono text-sm">revoke_session(token) -&gt; Result&lt;()&gt;</h4>
            <p className="text-sm text-gray-600 mb-4">Delete a specific session by token.</p>

            <h4 className="font-semibold text-gray-900 mb-2 font-mono text-sm">revoke_all_sessions(user_id) -&gt; Result&lt;()&gt;</h4>
            <p className="text-sm text-gray-600 mb-4">Delete all sessions for a user. Useful for "sign out everywhere".</p>
          </Section>

          {/* REST API */}
          <Section id="rest-api" title="REST API Endpoints">
            <p>
              These are the endpoints the SDK calls on the FutureAuth server. You don't call these directly — the SDK handles it.
              Documented here for reference.
            </p>
            <div className="overflow-x-auto mt-4">
              <table className="w-full text-sm border border-gray-200 rounded-lg overflow-hidden">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left px-4 py-2 font-medium text-gray-700">Method</th>
                    <th className="text-left px-4 py-2 font-medium text-gray-700">Path</th>
                    <th className="text-left px-4 py-2 font-medium text-gray-700">Auth</th>
                    <th className="text-left px-4 py-2 font-medium text-gray-700">Description</th>
                  </tr>
                </thead>
                <tbody className="text-gray-600">
                  <tr className="border-t">
                    <td className="px-4 py-2 font-mono text-xs">POST</td>
                    <td className="px-4 py-2 font-mono text-xs">/api/v1/otp/send</td>
                    <td className="px-4 py-2 text-xs">Secret key</td>
                    <td className="px-4 py-2">Deliver an OTP code via email or SMS</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </Section>

          {/* Dashboard API */}
          <Section id="dashboard-api" title="Dashboard API">
            <p>
              Manage projects and API keys programmatically. Create API keys in{' '}
              <Link to="/settings" className="text-emerald-600 underline">Settings</Link>.
            </p>
            <h4 className="font-semibold text-gray-900 mt-4 mb-2">Authentication</h4>
            <CodeBlock
              label="API key header"
              code={`Authorization: Bearer vxk_YOUR_API_KEY`}
              copied={copied}
              onCopy={copy}
            />
            <h4 className="font-semibold text-gray-900 mt-4 mb-2">Endpoints</h4>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border border-gray-200 rounded-lg overflow-hidden">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left px-4 py-2 font-medium text-gray-700">Method</th>
                    <th className="text-left px-4 py-2 font-medium text-gray-700">Path</th>
                    <th className="text-left px-4 py-2 font-medium text-gray-700">Description</th>
                  </tr>
                </thead>
                <tbody className="text-gray-600">
                  <tr className="border-t"><td className="px-4 py-2 font-mono text-xs">GET</td><td className="px-4 py-2 font-mono text-xs">/api/projects</td><td className="px-4 py-2">List your projects</td></tr>
                  <tr className="border-t"><td className="px-4 py-2 font-mono text-xs">POST</td><td className="px-4 py-2 font-mono text-xs">/api/projects</td><td className="px-4 py-2">Create a project</td></tr>
                  <tr className="border-t"><td className="px-4 py-2 font-mono text-xs">GET</td><td className="px-4 py-2 font-mono text-xs">/api/projects/:id</td><td className="px-4 py-2">Get project details</td></tr>
                  <tr className="border-t"><td className="px-4 py-2 font-mono text-xs">PUT</td><td className="px-4 py-2 font-mono text-xs">/api/projects/:id</td><td className="px-4 py-2">Update a project</td></tr>
                  <tr className="border-t"><td className="px-4 py-2 font-mono text-xs">DELETE</td><td className="px-4 py-2 font-mono text-xs">/api/projects/:id</td><td className="px-4 py-2">Delete a project</td></tr>
                  <tr className="border-t"><td className="px-4 py-2 font-mono text-xs">GET</td><td className="px-4 py-2 font-mono text-xs">/api/keys</td><td className="px-4 py-2">List API keys</td></tr>
                  <tr className="border-t"><td className="px-4 py-2 font-mono text-xs">POST</td><td className="px-4 py-2 font-mono text-xs">/api/keys</td><td className="px-4 py-2">Create an API key</td></tr>
                  <tr className="border-t"><td className="px-4 py-2 font-mono text-xs">DELETE</td><td className="px-4 py-2 font-mono text-xs">/api/keys/:id</td><td className="px-4 py-2">Delete an API key</td></tr>
                </tbody>
              </table>
            </div>
            <h4 className="font-semibold text-gray-900 mt-6 mb-2">Examples</h4>
            <CodeBlock
              label="Create a project"
              code={`curl -X POST ${futureauthUrl}/api/projects \\
  -H "Authorization: Bearer vxk_YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"name": "My App", "otp_mode": "email"}'

# Response:
# {
#   "id": "abc123",
#   "name": "My App",
#   "otp_mode": "email",
#   "secret_key": "vx_sec_xxxx",
#   "created_at": "2026-03-29T..."
# }`}
              copied={copied}
              onCopy={copy}
            />
          </Section>

          {/* Errors */}
          <Section id="errors" title="Error Handling">
            <p>The SDK returns <code className="code-inline">FutureAuthError</code> for all operations:</p>
            <div className="overflow-x-auto mt-4">
              <table className="w-full text-sm border border-gray-200 rounded-lg overflow-hidden">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left px-4 py-2 font-medium text-gray-700">Error</th>
                    <th className="text-left px-4 py-2 font-medium text-gray-700">When</th>
                    <th className="text-left px-4 py-2 font-medium text-gray-700">What to do</th>
                  </tr>
                </thead>
                <tbody className="text-gray-600">
                  <tr className="border-t"><td className="px-4 py-2 font-mono text-xs">InvalidOtp</td><td className="px-4 py-2">Wrong code entered</td><td className="px-4 py-2">Ask user to re-enter or resend</td></tr>
                  <tr className="border-t"><td className="px-4 py-2 font-mono text-xs">OtpExpired</td><td className="px-4 py-2">Code expired (default: 10 min)</td><td className="px-4 py-2">Send a new code</td></tr>
                  <tr className="border-t"><td className="px-4 py-2 font-mono text-xs">OtpDeliveryFailed</td><td className="px-4 py-2">FutureAuth API couldn't send</td><td className="px-4 py-2">Check secret key, project config</td></tr>
                  <tr className="border-t"><td className="px-4 py-2 font-mono text-xs">SessionNotFound</td><td className="px-4 py-2">Invalid/expired token</td><td className="px-4 py-2">Redirect to sign-in</td></tr>
                  <tr className="border-t"><td className="px-4 py-2 font-mono text-xs">DatabaseError</td><td className="px-4 py-2">sqlx error</td><td className="px-4 py-2">Check DATABASE_URL, connectivity</td></tr>
                </tbody>
              </table>
            </div>
            <CodeBlock
              label="Error handling example"
              code={`use futureauth::FutureAuthError;

match auth.verify_otp(email, code, ip, ua).await {
    Ok((user, session)) => { /* success */ }
    Err(FutureAuthError::InvalidOtp) => { /* wrong code */ }
    Err(FutureAuthError::OtpExpired) => { /* code expired */ }
    Err(e) => { /* other error */ }
}`}
              copied={copied}
              onCopy={copy}
            />
          </Section>

          {/* Troubleshooting */}
          <Section id="troubleshooting" title="Troubleshooting">
            <div className="space-y-6">
              <TroubleshootItem
                q="OtpDeliveryFailed error when calling send_otp()"
                a="The FutureAuth API could not deliver the code. Check that: (1) your secret key is correct, (2) the project exists and is configured for the right OTP mode, (3) the FutureAuth API is reachable from your server."
              />
              <TroubleshootItem
                q="InvalidOtp or OtpExpired when calling verify_otp()"
                a="The code was wrong or expired. Codes expire after 10 minutes by default (configurable via otp_ttl). Codes are single-use — once verified, they're deleted. Sending a new code also invalidates any previous code."
              />
              <TroubleshootItem
                q="Session validation always returns None"
                a="Check that: (1) the cookie name matches your config (default: futureauth_session), (2) sessions haven't expired (default: 30 days), (3) you're passing the raw token, not the cookie header."
              />
              <TroubleshootItem
                q="Database errors on startup"
                a="Make sure ensure_tables() runs before any auth operations. Verify your DATABASE_URL is correct and the Postgres database is accessible. The SDK needs CREATE TABLE permissions."
              />
              <TroubleshootItem
                q="AuthSession extractor returns 401 unexpectedly"
                a="The extractor reads the futureauth_session cookie. Make sure: (1) the cookie is being set correctly after verify_otp, (2) the cookie domain/path matches your setup, (3) your AppState implements AsRef<Arc<FutureAuth>>."
              />
              <TroubleshootItem
                q="404 on /api/auth/get-session or 405 on auth routes"
                a="The FutureAuth SDK routes are: /api/auth/session (not /get-session), /api/auth/send-otp, /api/auth/verify-otp, and /api/auth/sign-out. If using a third-party auth client like better-auth, replace it with direct fetch calls — the route paths are different. Also make sure you used .merge() not .nest() when mounting auth_router()."
              />
              <TroubleshootItem
                q="Using .nest() causes all auth routes to 404"
                a='The auth_router() routes already include the /api/auth/ prefix. Using .nest("/api/auth", ...) would create /api/auth/api/auth/... paths. Use .merge(futureauth::axum::auth_router(state.auth.clone())) instead.'
              />
              <TroubleshootItem
                q="How do I use FutureAuth without Axum?"
                a='Don&apos;t enable the axum-integration feature. Use the core SDK methods directly: send_otp(), verify_otp(), get_session(), revoke_session(). You handle cookie/token extraction yourself.'
              />
            </div>
          </Section>

          {/* Footer links */}
          <div className="border-t border-gray-200 pt-8 mt-12 flex flex-wrap gap-6 text-sm">
            <a href="https://crates.io/crates/futureauth" target="_blank" rel="noopener" className="text-emerald-600 hover:text-emerald-700 flex items-center gap-1.5">
              <Package size={14} />
              crates.io/crates/futureauth
            </a>
            <a href="https://github.com/ethereumdegen/futureauth-sdk" target="_blank" rel="noopener" className="text-emerald-600 hover:text-emerald-700 flex items-center gap-1.5">
              <Terminal size={14} />
              GitHub
            </a>
            <a href="https://github.com/ethereumdegen/future-auth-sample-project" target="_blank" rel="noopener" className="text-emerald-600 hover:text-emerald-700 flex items-center gap-1.5">
              <Rocket size={14} />
              Sample Project
            </a>
            <Link to="/sign-in" className="text-emerald-600 hover:text-emerald-700">
              Dashboard
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}

function SidebarGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-4">
      <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">{title}</h4>
      <div className="space-y-0.5">{children}</div>
    </div>
  )
}

function SidebarLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a href={href} className="block px-2 py-1 text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded transition-colors text-sm">
      {children}
    </a>
  )
}

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="mb-14 scroll-mt-20">
      <h2 className="text-xl font-bold text-gray-900 mb-3">{title}</h2>
      <div className="text-gray-600 text-[15px] leading-relaxed">{children}</div>
    </section>
  )
}

function CodeBlock({ label, code, copied, onCopy }: { label: string; code: string; copied: string; onCopy: (v: string, l: string) => void }) {
  return (
    <div className="bg-gray-950 rounded-xl overflow-hidden mb-4">
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-800">
        <span className="text-xs text-gray-500">{label}</span>
        <button onClick={() => onCopy(code, label)} className="text-gray-500 hover:text-gray-300 transition-colors">
          {copied === label ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
        </button>
      </div>
      <pre className="p-4 text-sm text-gray-300 overflow-x-auto whitespace-pre-wrap">{code}</pre>
    </div>
  )
}

function Tabs({ tabs }: { tabs: { label: string; content: React.ReactNode }[] }) {
  const [active, setActive] = useState(0)
  return (
    <div className="mb-4">
      <div className="flex gap-1 mb-3">
        {tabs.map((t, i) => (
          <button
            key={t.label}
            onClick={() => setActive(i)}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              active === i ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-500 hover:text-gray-900'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tabs[active].content}
    </div>
  )
}

function Callout({ children, type = 'info' }: { children: React.ReactNode; type?: 'info' | 'warn' }) {
  const styles = type === 'warn'
    ? 'border-amber-400 bg-amber-50 text-amber-800'
    : 'border-emerald-400 bg-emerald-50 text-emerald-800'
  return (
    <div className={`border-l-2 px-4 py-3 rounded-r-lg text-sm mt-4 ${styles}`}>
      {children}
    </div>
  )
}

function TroubleshootItem({ q, a }: { q: string; a: string }) {
  return (
    <div>
      <h4 className="font-semibold text-gray-900 text-sm">{q}</h4>
      <p className="text-gray-600 text-sm mt-1">{a}</p>
    </div>
  )
}
