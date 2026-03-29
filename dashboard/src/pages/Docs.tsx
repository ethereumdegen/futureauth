import { Link } from 'react-router'
import { ArrowLeft, Phone, Copy, Check } from 'lucide-react'
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
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center gap-3">
          <Link to="/" className="text-gray-400 hover:text-gray-900 transition-colors">
            <ArrowLeft size={16} />
          </Link>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-emerald-600 rounded-lg flex items-center justify-center">
              <Phone size={14} className="text-white" />
            </div>
            <span className="text-lg font-bold text-gray-900">FutureAuth</span>
          </div>
          <span className="text-gray-300">/</span>
          <span className="text-sm text-gray-500 font-medium">Integration Guide</span>
        </div>
      </nav>

      <div className="max-w-3xl mx-auto px-6 py-10">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Integration Guide</h1>
        <p className="text-gray-500 mb-10">Add passwordless OTP authentication to your Rust app with the FutureAuth SDK.</p>

        {/* Overview */}
        <Section id="overview" title="How it works">
          <p>
            FutureAuth is an <strong>OTP delivery service</strong>. The <code className="bg-gray-100 px-1.5 py-0.5 rounded text-sm">futureauth</code> Rust SDK
            handles all auth logic locally — users, sessions, and verification codes are stored in <strong>your own Postgres database</strong>.
            FutureAuth's server only delivers the OTP codes via Resend (email) or Twilio (SMS).
          </p>
          <ol className="list-decimal list-inside space-y-1 mt-3 text-gray-600">
            <li>Create a project in the FutureAuth dashboard</li>
            <li>Install the <code className="bg-gray-100 px-1.5 py-0.5 rounded text-sm">futureauth</code> SDK crate in your Rust project</li>
            <li>Initialize the SDK with your secret key and database pool</li>
            <li>Use <code className="bg-gray-100 px-1.5 py-0.5 rounded text-sm">send_otp</code> and <code className="bg-gray-100 px-1.5 py-0.5 rounded text-sm">verify_otp</code> for auth flows</li>
            <li>Sessions are stored and validated locally in your database</li>
          </ol>
        </Section>

        {/* Prerequisites */}
        <Section id="prerequisites" title="Prerequisites">
          <ul className="list-disc list-inside space-y-1 text-gray-600">
            <li>A Postgres database (Neon, Supabase, Railway Postgres, etc.)</li>
            <li>A Rust project using Axum (or any async framework)</li>
            <li>An account on FutureAuth — <Link to="/sign-in" className="text-emerald-600 underline">sign in here</Link></li>
          </ul>
        </Section>

        {/* Step 1 */}
        <Section id="create-project" title="1. Create a project">
          <p>
            Go to the <Link to="/" className="text-emerald-600 underline">dashboard</Link> and click <strong>New Project</strong>.
            Choose a name and select an OTP mode (email or phone).
          </p>
          <p className="mt-2">
            You'll receive a <strong>publishable key</strong> and <strong>secret key</strong>.
            The secret key is used by the SDK to authenticate with FutureAuth's OTP delivery API.
          </p>
          <Callout>
            Save your secret key immediately — it's only shown once on creation.
          </Callout>
        </Section>

        {/* Step 2 */}
        <Section id="install-sdk" title="2. Install the SDK">
          <CodeBlock
            label="Cargo.toml"
            code={`[dependencies]
futureauth = { git = "https://github.com/ethereumdegen/futureauth-sdk" }

# With Axum integration (routes + extractor):
# futureauth = { git = "https://github.com/ethereumdegen/futureauth-sdk", features = ["axum-integration"] }`}
            copied={copied}
            onCopy={copy}
          />
        </Section>

        {/* Step 3 */}
        <Section id="initialize" title="3. Initialize the SDK">
          <CodeBlock
            label="src/main.rs"
            code={`use futureauth::{FutureAuth, FutureAuthConfig};
use sqlx::PgPool;

let pool = PgPool::connect(&std::env::var("DATABASE_URL")?).await?;

let futureauth = FutureAuth::new(pool.clone(), FutureAuthConfig {
    api_url: "${futureauthUrl}".to_string(),
    secret_key: std::env::var("FUTUREAUTH_SECRET_KEY")?,
    project_name: "My App".to_string(),
    ..Default::default()
});

// Create auth tables (user, session, verification)
futureauth.ensure_tables().await?;`}
            copied={copied}
            onCopy={copy}
          />
          <Callout>
            <code className="text-xs">ensure_tables()</code> is idempotent — safe to call on every startup.
            It creates the <code className="text-xs">user</code>, <code className="text-xs">session</code>, and <code className="text-xs">verification</code> tables
            if they don't exist. All columns use snake_case.
          </Callout>
        </Section>

        {/* Step 4 */}
        <Section id="send-otp" title="4. Send OTP">
          <Tabs
            tabs={[
              {
                label: 'Email OTP',
                content: (
                  <CodeBlock
                    label="Email OTP"
                    code={`use futureauth::OtpChannel;

futureauth.send_otp(OtpChannel::Email, "user@example.com").await?;
// SDK generates a code, stores it in your DB, then calls
// FutureAuth API to deliver it via Resend`}
                    copied={copied}
                    onCopy={copy}
                  />
                ),
              },
              {
                label: 'Phone OTP',
                content: (
                  <CodeBlock
                    label="Phone OTP"
                    code={`use futureauth::OtpChannel;

futureauth.send_otp(OtpChannel::Phone, "+15551234567").await?;
// SDK generates a code, stores it in your DB, then calls
// FutureAuth API to deliver it via Twilio SMS`}
                    copied={copied}
                    onCopy={copy}
                  />
                ),
              },
            ]}
          />
        </Section>

        {/* Step 5 */}
        <Section id="verify-otp" title="5. Verify OTP">
          <CodeBlock
            label="Verify and create session"
            code={`// Returns (User, Session) on success
let (user, session) = futureauth.verify_otp(
    "user@example.com",  // or phone number
    "123456",            // the code they entered
    Some("127.0.0.1"),   // optional: IP address
    Some("Mozilla/5.0"), // optional: user agent
).await?;

// Set a cookie with the session token
// Cookie name defaults to "futureauth_session"
set_cookie("futureauth_session", &session.token);`}
            copied={copied}
            onCopy={copy}
          />
          <p className="text-sm text-gray-500 mt-2">
            If the user doesn't exist, they're auto-created. The verification code is deleted after use.
          </p>
        </Section>

        {/* Step 6 */}
        <Section id="session-check" title="6. Validate sessions">
          <CodeBlock
            label="Session validation"
            code={`// Extract token from cookie and validate
let token = get_cookie("futureauth_session");
match futureauth.get_session(&token).await? {
    Some((user, session)) => {
        // Authenticated! Use user.id, user.email, etc.
    }
    None => {
        // Invalid or expired session
    }
}`}
            copied={copied}
            onCopy={copy}
          />
        </Section>

        {/* Step 7 - Axum Integration */}
        <Section id="axum" title="7. Axum integration (optional)">
          <p className="mb-3">
            Enable the <code className="bg-gray-100 px-1.5 py-0.5 rounded text-sm">axum-integration</code> feature for pre-built routes and an auth extractor.
          </p>
          <CodeBlock
            label="Axum routes + extractor"
            code={`use futureauth::axum::{auth_router, AuthSession};
use axum::{Router, routing::get, Json};

let app = Router::new()
    // Mounts: POST /api/auth/send-otp
    //         POST /api/auth/verify-otp
    //         GET  /api/auth/session
    //         POST /api/auth/sign-out
    .nest("/api/auth", auth_router())
    // Use AuthSession extractor for protected routes
    .route("/api/me", get(me_handler))
    .with_state(futureauth);

// AuthSession extracts + validates the session from cookie
async fn me_handler(auth: AuthSession) -> Json<serde_json::Value> {
    serde_json::json!({
        "id": auth.user.id,
        "email": auth.user.email,
    }).into()
}`}
            copied={copied}
            onCopy={copy}
          />
        </Section>

        {/* Step 8 */}
        <Section id="sign-out" title="8. Sign out">
          <CodeBlock
            label="Revoke session"
            code={`// Revoke a single session
futureauth.revoke_session(&token).await?;

// Or revoke all sessions for a user
futureauth.revoke_all_sessions(&user.id).await?;`}
            copied={copied}
            onCopy={copy}
          />
        </Section>

        {/* Config */}
        <Section id="config" title="Configuration">
          <CodeBlock
            label="FutureAuthConfig options"
            code={`FutureAuthConfig {
    api_url: String,         // FutureAuth server URL
    secret_key: String,      // Project secret key
    project_name: String,    // Shown in OTP emails/SMS
    session_ttl: Duration,   // Default: 30 days
    otp_ttl: Duration,       // Default: 10 minutes
    otp_length: usize,       // Default: 6 digits
    cookie_name: String,     // Default: "futureauth_session"
}`}
            copied={copied}
            onCopy={copy}
          />
        </Section>

        {/* Database Schema */}
        <Section id="schema" title="Database schema">
          <p className="mb-3">
            The SDK creates these tables in your database via <code className="bg-gray-100 px-1.5 py-0.5 rounded text-sm">ensure_tables()</code>.
            All columns are snake_case.
          </p>
          <CodeBlock
            label="Tables created in your database"
            code={`"user"         — id, email, phone, name, email_verified, phone_verified, image, created_at, updated_at
session        — id, user_id, token, ip_address, user_agent, expires_at, created_at
verification   — id, identifier, code, expires_at, created_at`}
            copied={copied}
            onCopy={copy}
          />
        </Section>

        {/* API Keys */}
        <Section id="api-keys" title="Dashboard API keys">
          <p className="mb-3">
            You can also manage projects programmatically using dashboard API keys. Create one in{' '}
            <Link to="/settings" className="text-emerald-600 underline">Settings</Link>.
          </p>
          <CodeBlock
            label="cURL"
            code={`# List your projects
curl -H "Authorization: Bearer vxk_YOUR_API_KEY" \\
  ${futureauthUrl}/api/projects

# Create a project
curl -X POST -H "Authorization: Bearer vxk_YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"name":"My App","otp_mode":"email"}' \\
  ${futureauthUrl}/api/projects`}
            copied={copied}
            onCopy={copy}
          />
        </Section>

        {/* Troubleshooting */}
        <Section id="troubleshooting" title="Troubleshooting">
          <div className="space-y-4">
            <TroubleshootItem
              q="OtpDeliveryFailed error"
              a="Check that your FutureAuth project has valid Resend (email) or Twilio (SMS) credentials configured on the server. Verify your secret key is correct."
            />
            <TroubleshootItem
              q="InvalidOtp or OtpExpired"
              a="The code was wrong or expired (default: 10 minutes). Codes are single-use and deleted after verification."
            />
            <TroubleshootItem
              q="Session not found"
              a="The session token is invalid or expired. Sessions default to 30 days. Check that the cookie name matches your config."
            />
            <TroubleshootItem
              q="Database errors on startup"
              a="Make sure ensure_tables() runs before any auth operations. Check your DATABASE_URL is correct and the database is accessible."
            />
          </div>
        </Section>
      </div>
    </div>
  )
}

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="mb-12">
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

function Callout({ children }: { children: React.ReactNode }) {
  return (
    <div className="border-l-2 border-amber-400 bg-amber-50 px-4 py-3 rounded-r-lg text-sm text-amber-800 mt-4">
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
