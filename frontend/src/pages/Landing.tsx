import { Link } from 'react-router'
import { Mail, Phone, ArrowRight, Shield, Zap, Database, Terminal, BookOpen, Github, Package, Link as LinkIcon, LogOut } from 'lucide-react'
import { signOut, type AuthUser } from '../lib/auth-client'

export default function Landing({ user, onSignOut }: { user?: AuthUser | null; onSignOut?: () => void }) {
  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <nav className="border-b border-gray-800/50 sticky top-0 bg-gray-950/70 backdrop-blur-xl z-10">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-emerald-600 rounded-lg flex items-center justify-center">
              <Shield size={16} />
            </div>
            <span className="text-xl font-bold">FutureAuth</span>
          </div>
          <div className="flex items-center gap-4">
            <a href="https://crates.io/crates/futureauth" target="_blank" rel="noopener" className="text-gray-400 hover:text-white text-sm transition-colors flex items-center gap-1.5">
              <Package size={14} />
              crates.io
            </a>
            <a href="https://github.com/ethereumdegen/futureauth-sdk" target="_blank" rel="noopener" className="text-gray-400 hover:text-white text-sm transition-colors flex items-center gap-1.5">
              <Github size={14} />
              GitHub
            </a>
            <Link to="/docs" className="text-gray-400 hover:text-white text-sm transition-colors flex items-center gap-1.5">
              <BookOpen size={14} />
              Docs
            </Link>
            {user ? (
              <>
                <Link to="/dashboard" className="bg-white text-gray-900 hover:bg-gray-100 px-4 py-2 rounded-lg text-sm font-medium transition-colors">
                  Dashboard
                </Link>
                <span className="text-sm text-gray-400">{user.email}</span>
                <button
                  onClick={() => signOut().then(() => onSignOut?.())}
                  className="text-gray-400 hover:text-white p-1.5 rounded-lg hover:bg-gray-800 transition-colors"
                  title="Sign out"
                >
                  <LogOut size={16} />
                </button>
              </>
            ) : (
              <Link to="/sign-in" className="bg-white text-gray-900 hover:bg-gray-100 px-4 py-2 rounded-lg text-sm font-medium transition-colors">
                Dashboard
              </Link>
            )}
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-5xl mx-auto px-6 pt-28 pb-16">
        <div className="max-w-3xl">
          <div className="inline-flex items-center gap-2 bg-emerald-600/10 border border-emerald-600/20 rounded-full px-4 py-1.5 mb-6">
            <LinkIcon size={14} className="text-emerald-400" />
            <span className="text-sm text-emerald-400 font-medium">Now with magic link auth</span>
          </div>
          <h1 className="text-5xl sm:text-6xl font-bold leading-tight mb-6">
            Passwordless auth
            <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-teal-400">
              for Rust apps
            </span>
          </h1>
          <p className="text-xl text-gray-400 leading-relaxed mb-8">
            Install magic link logins to any Rust backend. Users and sessions live in your own database.
            FutureAuth delivers the emails.
          </p>

          {/* Install command */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden mb-8 max-w-lg">
            <div className="flex items-center gap-2 px-4 py-2.5 border-b border-gray-800">
              <Terminal size={14} className="text-gray-500" />
              <span className="text-xs text-gray-500 font-mono">terminal</span>
            </div>
            <div className="px-4 py-3">
              <code className="text-emerald-400 font-mono text-sm">$ cargo add futureauth</code>
            </div>
          </div>

          <div className="flex items-center gap-4 flex-wrap">
            <Link
              to={user ? "/dashboard" : "/sign-in"}
              className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-8 py-3.5 rounded-xl text-lg font-medium transition-colors"
            >
              Get API Keys <ArrowRight size={20} />
            </Link>
            <Link
              to="/docs"
              className="inline-flex items-center gap-2 border border-gray-700 hover:border-gray-500 text-gray-300 hover:text-white px-8 py-3.5 rounded-xl text-lg font-medium transition-colors"
            >
              Read the Docs
            </Link>
          </div>
        </div>
      </section>

      {/* Code preview */}
      <section className="max-w-5xl mx-auto px-6 pb-24">
        <div className="bg-gray-900/50 border border-gray-800/50 rounded-2xl overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-3 border-b border-gray-800/50">
            <div className="w-3 h-3 rounded-full bg-gray-700" />
            <div className="w-3 h-3 rounded-full bg-gray-700" />
            <div className="w-3 h-3 rounded-full bg-gray-700" />
            <span className="text-xs text-gray-600 ml-2 font-mono">src/main.rs</span>
          </div>
          <pre className="p-6 text-sm leading-relaxed overflow-x-auto">
            <code>{`use futureauth::{FutureAuth, FutureAuthConfig};
use futureauth::axum::{auth_router, AuthSession};
use axum::{Router, routing::get, Json};
use sqlx::PgPool;

#[tokio::main]
async fn main() {
    let pool = PgPool::connect(&std::env::var("DATABASE_URL").unwrap()).await.unwrap();

    let auth = FutureAuth::new(pool.clone(), FutureAuthConfig {
        api_url: "https://future-auth.com".into(),
        secret_key: std::env::var("FUTUREAUTH_SECRET_KEY").unwrap(),
        project_name: "My App".into(),
        ..Default::default()
    });
    auth.ensure_tables().await.unwrap();

    let state = AppState { auth: Arc::new(auth) };

    let app = Router::new()
        // Adds /api/auth/send-magic-link, /api/auth/verify-magic-link,
        // /api/auth/send-otp, /api/auth/verify-otp, session, sign-out
        .merge(futureauth::axum::auth_router(state.auth.clone()))
        .route("/api/me", get(me))
        .with_state(state);

    // ...
}

async fn me(auth: AuthSession) -> Json<serde_json::Value> {
    Json(serde_json::json!({
        "id": auth.user.id,
        "email": auth.user.email,
    }))
}`}</code>
          </pre>
        </div>
      </section>

      {/* Architecture */}
      <section className="border-t border-gray-800/50 bg-gray-900/20">
        <div className="max-w-5xl mx-auto px-6 py-24">
          <h2 className="text-2xl font-bold mb-3 text-center">How it works</h2>
          <p className="text-gray-500 text-center mb-14 max-w-xl mx-auto">
            Your app owns the data. FutureAuth delivers the emails and SMS.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="bg-gray-900/50 border border-gray-800/50 rounded-xl p-6">
              <h3 className="font-semibold text-emerald-400 mb-4 flex items-center gap-2">
                <Database size={18} />
                Your Postgres
              </h3>
              <ul className="space-y-2 text-sm text-gray-400">
                <li className="flex items-start gap-2"><span className="text-emerald-400 mt-0.5">&#x2713;</span> Users table with email, phone, metadata</li>
                <li className="flex items-start gap-2"><span className="text-emerald-400 mt-0.5">&#x2713;</span> Sessions with opaque tokens, IP, user agent</li>
                <li className="flex items-start gap-2"><span className="text-emerald-400 mt-0.5">&#x2713;</span> Verification codes and magic link tokens (auto-deleted after use)</li>
                <li className="flex items-start gap-2"><span className="text-emerald-400 mt-0.5">&#x2713;</span> Created by <code className="text-xs bg-gray-800 px-1 rounded">ensure_tables()</code> — zero manual migrations</li>
              </ul>
            </div>
            <div className="bg-gray-900/50 border border-gray-800/50 rounded-xl p-6">
              <h3 className="font-semibold text-emerald-400 mb-4 flex items-center gap-2">
                <Zap size={18} />
                FutureAuth API
              </h3>
              <ul className="space-y-2 text-sm text-gray-400">
                <li className="flex items-start gap-2"><span className="text-emerald-400 mt-0.5">&#x2713;</span> Sends magic link emails with one-click sign-in</li>
                <li className="flex items-start gap-2"><span className="text-emerald-400 mt-0.5">&#x2713;</span> Delivers OTP codes via email (Resend) or SMS (Twilio)</li>
                <li className="flex items-start gap-2"><span className="text-emerald-400 mt-0.5">&#x2713;</span> Does not store users or sessions</li>
                <li className="flex items-start gap-2"><span className="text-emerald-400 mt-0.5">&#x2713;</span> Callback URL configured per project in the dashboard</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Features grid */}
      <section className="border-t border-gray-800/50">
        <div className="max-w-5xl mx-auto px-6 py-24">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
            <div>
              <div className="w-10 h-10 bg-emerald-600/10 rounded-xl flex items-center justify-center mb-4">
                <LinkIcon size={20} className="text-emerald-400" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Magic Links</h3>
              <p className="text-gray-400 text-sm leading-relaxed">
                One-click sign-in via email. No codes to type. Set a callback URL per project and you're done.
              </p>
            </div>
            <div>
              <div className="w-10 h-10 bg-emerald-600/10 rounded-xl flex items-center justify-center mb-4">
                <Mail size={20} className="text-emerald-400" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Email OTP</h3>
              <p className="text-gray-400 text-sm leading-relaxed">
                Send verification codes via Resend. Beautiful branded emails, high deliverability.
              </p>
            </div>
            <div>
              <div className="w-10 h-10 bg-emerald-600/10 rounded-xl flex items-center justify-center mb-4">
                <Phone size={20} className="text-emerald-400" />
              </div>
              <h3 className="text-lg font-semibold mb-2">SMS OTP</h3>
              <p className="text-gray-400 text-sm leading-relaxed">
                Send verification codes via Twilio. Global coverage, reliable delivery.
              </p>
            </div>
            <div>
              <div className="w-10 h-10 bg-emerald-600/10 rounded-xl flex items-center justify-center mb-4">
                <Database size={20} className="text-emerald-400" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Your database</h3>
              <p className="text-gray-400 text-sm leading-relaxed">
                Users and sessions live in your own Postgres. Zero vendor lock-in. Full data ownership.
              </p>
            </div>
            <div>
              <div className="w-10 h-10 bg-emerald-600/10 rounded-xl flex items-center justify-center mb-4">
                <Shield size={20} className="text-emerald-400" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Secure sessions</h3>
              <p className="text-gray-400 text-sm leading-relaxed">
                Opaque session tokens, 30-day TTL, IP and user agent tracking. Revoke anytime.
              </p>
            </div>
            <div>
              <div className="w-10 h-10 bg-emerald-600/10 rounded-xl flex items-center justify-center mb-4">
                <Terminal size={20} className="text-emerald-400" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Axum integration</h3>
              <p className="text-gray-400 text-sm leading-relaxed">
                Pre-built auth routes and <code className="text-xs bg-gray-800 px-1 rounded">AuthSession</code> extractor. Mount and go.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Steps */}
      <section className="border-t border-gray-800/50 bg-gray-900/20">
        <div className="max-w-5xl mx-auto px-6 py-24">
          <h2 className="text-2xl font-bold mb-14 text-center">Get started in 4 steps</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            {[
              { step: '1', title: 'Install the SDK', code: 'cargo add futureauth' },
              { step: '2', title: 'Get API keys', code: 'Sign in at future-auth.com' },
              { step: '3', title: 'Set callback URL', code: 'Configure in the dashboard' },
              { step: '4', title: 'Ship it', code: 'send_magic_link() / send_otp()' },
            ].map((s) => (
              <div key={s.step} className="text-center">
                <div className="w-10 h-10 bg-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4 text-sm font-bold">
                  {s.step}
                </div>
                <h3 className="font-semibold text-white mb-2">{s.title}</h3>
                <p className="text-gray-500 text-sm font-mono">{s.code}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-gray-800/50">
        <div className="max-w-5xl mx-auto px-6 py-24 text-center">
          <h2 className="text-3xl font-bold mb-4">Ready to drop passwords?</h2>
          <p className="text-gray-400 mb-4">Free to start. Add magic link or OTP auth to your Rust app today.</p>
          <div className="bg-gray-900 border border-gray-800 rounded-xl inline-block px-6 py-3 mb-8">
            <code className="text-emerald-400 font-mono">$ cargo add futureauth</code>
          </div>
          <div className="flex items-center justify-center gap-4 flex-wrap">
            <Link
              to={user ? "/dashboard" : "/sign-in"}
              className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-8 py-3.5 rounded-xl text-lg font-medium transition-colors"
            >
              Get API Keys <ArrowRight size={20} />
            </Link>
            <a
              href="https://crates.io/crates/futureauth"
              target="_blank"
              rel="noopener"
              className="inline-flex items-center gap-2 border border-gray-700 hover:border-gray-500 text-gray-300 hover:text-white px-8 py-3.5 rounded-xl text-lg font-medium transition-colors"
            >
              <Package size={20} />
              View on crates.io
            </a>
          </div>
        </div>
      </section>

      <footer className="border-t border-gray-800/50">
        <div className="max-w-5xl mx-auto px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <span className="text-sm text-gray-600">FutureAuth — Passwordless auth for Rust</span>
          <div className="flex items-center gap-6 text-sm text-gray-600">
            <Link to="/docs" className="hover:text-gray-400 transition-colors">Docs</Link>
            <a href="https://github.com/ethereumdegen/futureauth-sdk" target="_blank" rel="noopener" className="hover:text-gray-400 transition-colors">GitHub</a>
            <a href="https://github.com/ethereumdegen/future-auth-sample-project" target="_blank" rel="noopener" className="hover:text-gray-400 transition-colors">Sample Project</a>
            <a href="https://crates.io/crates/futureauth" target="_blank" rel="noopener" className="hover:text-gray-400 transition-colors">crates.io</a>
          </div>
        </div>
      </footer>
    </div>
  )
}
