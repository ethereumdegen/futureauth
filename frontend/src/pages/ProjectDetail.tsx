import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router'
import { getProject, deleteProject, updateProject, regenerateProjectKeys, type Project } from '../lib/api'
import { ArrowLeft, Copy, Check, Phone, Mail, Trash2, Code, Pencil, RefreshCw } from 'lucide-react'
import { useNavigate } from 'react-router'

export default function ProjectDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [project, setProject] = useState<Project | null>(null)
  const [copied, setCopied] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [regenerating, setRegenerating] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editName, setEditName] = useState('')

  useEffect(() => {
    if (!id) return
    getProject(id).then(setProject)
  }, [id])

  function copy(text: string, label: string) {
    navigator.clipboard.writeText(text)
    setCopied(label)
    setTimeout(() => setCopied(''), 2000)
  }

  async function handleDelete() {
    if (!id || !confirm('Delete this project? This cannot be undone.')) return
    setDeleting(true)
    try {
      await deleteProject(id)
      navigate('/')
    } finally {
      setDeleting(false)
    }
  }

  async function handleRegenerateKeys() {
    if (!id || !confirm('Regenerate keys? Your old keys will stop working immediately.')) return
    setRegenerating(true)
    try {
      const updated = await regenerateProjectKeys(id)
      setProject(updated)
    } finally {
      setRegenerating(false)
    }
  }

  async function handleRename() {
    if (!id || !editName.trim()) return
    const updated = await updateProject(id, { name: editName.trim() })
    setProject(updated)
    setEditing(false)
  }

  if (!project) {
    return <div className="min-h-screen bg-white flex items-center justify-center text-gray-400">Loading...</div>
  }

  const isPhone = project.otp_mode === 'phone'
  const futureauthUrl = window.location.origin

  const cargoToml = `[dependencies]
futureauth = { git = "https://github.com/ethereumdegen/futureauth-sdk" }
# Enable Axum integration for auth routes + extractor
# futureauth = { git = "https://github.com/ethereumdegen/futureauth-sdk", features = ["axum-integration"] }`

  const rustSetup = `use futureauth::{FutureAuth, FutureAuthConfig, OtpChannel};
use sqlx::PgPool;

let pool = PgPool::connect(&std::env::var("DATABASE_URL")?).await?;

let futureauth = FutureAuth::new(pool.clone(), FutureAuthConfig {
    api_url: "${futureauthUrl}".to_string(),
    secret_key: "${project.secret_key || "sk_your_secret_key"}".to_string(),
    project_name: "${project.name}".to_string(),
    ..Default::default()
});

// Create auth tables in your database
futureauth.ensure_tables().await?;`

  const sendOtpCode = isPhone
    ? `// Send OTP via SMS
futureauth.send_otp(
    OtpChannel::Phone,
    "+15551234567",
).await?;`
    : `// Send OTP via email
futureauth.send_otp(
    OtpChannel::Email,
    "user@example.com",
).await?;`

  const verifyCode = isPhone
    ? `// Verify OTP — returns (User, Session)
let (user, session) = futureauth.verify_otp(
    "+15551234567",
    "a1b2c3",
    Some(ip_address),
    Some(user_agent),
).await?;
// Set cookie: session.token`
    : `// Verify OTP — returns (User, Session)
let (user, session) = futureauth.verify_otp(
    "user@example.com",
    "a1b2c3",
    Some(ip_address),
    Some(user_agent),
).await?;
// Set cookie: session.token`

  const sessionCheck = `// Validate session from cookie
let token = extract_cookie("futureauth_session");
if let Some((user, session)) = futureauth.get_session(&token).await? {
    // user is authenticated
}`

  const axumRoutes = `use futureauth::axum::{auth_router, AuthSession};

// Mount auth routes: /api/auth/send-otp, verify-otp, session, sign-out
let app = Router::new()
    .nest("/api/auth", auth_router())
    .route("/api/me", get(me_handler))
    .with_state(futureauth);

async fn me_handler(auth: AuthSession) -> Json<User> {
    Json(auth.user)
}`

  return (
    <div className="min-h-screen bg-white">
      <nav className="border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-6 py-4">
          <Link to="/" className="flex items-center gap-2 text-gray-500 hover:text-gray-900 text-sm transition-colors">
            <ArrowLeft size={16} /> Back to projects
          </Link>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-6 py-10">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-3">
            {editing ? (
              <form onSubmit={e => { e.preventDefault(); handleRename() }} className="flex items-center gap-2">
                <input
                  autoFocus
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  onKeyDown={e => e.key === 'Escape' && setEditing(false)}
                  className="text-2xl font-bold text-gray-900 border-b-2 border-gray-300 focus:border-gray-900 outline-none bg-transparent"
                />
                <button type="submit" className="text-sm text-gray-500 hover:text-gray-900">Save</button>
                <button type="button" onClick={() => setEditing(false)} className="text-sm text-gray-400 hover:text-gray-600">Cancel</button>
              </form>
            ) : (
              <>
                <h1 className="text-2xl font-bold text-gray-900">{project.name}</h1>
                <button onClick={() => { setEditName(project.name); setEditing(true) }} className="text-gray-400 hover:text-gray-700">
                  <Pencil size={14} />
                </button>
              </>
            )}
            <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${
              isPhone ? 'bg-blue-50 text-blue-700' : 'bg-purple-50 text-purple-700'
            }`}>
              {isPhone ? <Phone size={10} /> : <Mail size={10} />}
              {isPhone ? 'Phone OTP' : 'Email OTP'}
            </span>
          </div>
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="flex items-center gap-2 text-gray-400 hover:text-red-600 text-sm transition-colors"
          >
            <Trash2 size={14} /> {deleting ? 'Deleting...' : 'Delete'}
          </button>
        </div>
        <p className="text-gray-400 text-sm font-mono mb-8">{project.id}</p>

        <div className="space-y-8">
          {/* API Keys */}
          <section>
            <h2 className="text-sm font-semibold text-gray-900 mb-3 uppercase tracking-wider">Secret Key</h2>
            <div className="space-y-2">
              {project.secret_key && (
                <KeyRow label="Secret Key" value={project.secret_key} copied={copied} onCopy={copy} secret />
              )}
              {!project.secret_key && (
                <div className="text-xs text-gray-400 mt-1">
                  Secret key was shown on creation only.
                </div>
              )}
              <button
                onClick={handleRegenerateKeys}
                disabled={regenerating}
                className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900 mt-2 transition-colors"
              >
                <RefreshCw size={14} className={regenerating ? 'animate-spin' : ''} />
                {regenerating ? 'Regenerating...' : 'Regenerate Keys'}
              </button>
            </div>
          </section>

          {/* SDK Setup */}
          <section>
            <h2 className="text-sm font-semibold text-gray-900 mb-3 uppercase tracking-wider">
              <Code size={14} className="inline mr-1" />
              SDK Integration (Rust)
            </h2>
            <CodeBlock file="Cargo.toml" code={cargoToml} />
          </section>

          <section>
            <h2 className="text-sm font-semibold text-gray-900 mb-3 uppercase tracking-wider">Initialize</h2>
            <CodeBlock file="src/main.rs" code={rustSetup} />
          </section>

          <section>
            <h2 className="text-sm font-semibold text-gray-900 mb-3 uppercase tracking-wider">Send OTP</h2>
            <CodeBlock file={isPhone ? 'Phone OTP' : 'Email OTP'} code={sendOtpCode} />
          </section>

          <section>
            <h2 className="text-sm font-semibold text-gray-900 mb-3 uppercase tracking-wider">Verify OTP</h2>
            <CodeBlock file="Verify & create session" code={verifyCode} />
            <div className="border-l-2 border-amber-400 bg-amber-50 text-amber-800 px-4 py-3 rounded-r-lg text-sm mt-2 mb-4">
              <strong>Important:</strong> Add brute-force protection on your verify endpoint. Use escalating delays
              after each failed attempt (e.g., 0s → 30s → 60s → 5min → invalidate code).
              Without attempt limits, an attacker could make unlimited guesses. See the{' '}
              <Link to="/docs#brute-force" className="underline font-medium">docs</Link> for a full example.
            </div>
          </section>

          <section>
            <h2 className="text-sm font-semibold text-gray-900 mb-3 uppercase tracking-wider">Session Check</h2>
            <CodeBlock file="Validate authenticated requests" code={sessionCheck} />
          </section>

          <section>
            <h2 className="text-sm font-semibold text-gray-900 mb-3 uppercase tracking-wider">Axum Routes (optional)</h2>
            <p className="text-sm text-gray-500 mb-3">
              Enable the <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs">axum-integration</code> feature for pre-built auth routes and extractors.
            </p>
            <CodeBlock file="With axum-integration feature" code={axumRoutes} />
          </section>

          {/* Architecture note */}
          <section className="border-t border-gray-200 pt-8">
            <h2 className="text-sm font-semibold text-gray-900 mb-3 uppercase tracking-wider">How it works</h2>
            <div className="text-sm text-gray-600 space-y-2">
              <p>FutureAuth is an <strong>OTP delivery service</strong>. When you call <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs">send_otp</code>, the SDK:</p>
              <ol className="list-decimal list-inside space-y-1 ml-2">
                <li>Generates a random code and stores it in <strong>your</strong> database (verification table)</li>
                <li>Sends the code to FutureAuth's API for delivery via {isPhone ? 'Twilio SMS' : 'Resend email'}</li>
              </ol>
              <p className="mt-3">On <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs">verify_otp</code>, the SDK checks the code against your local verification table, creates/finds the user, and creates a session — all in <strong>your</strong> database. FutureAuth never sees your database.</p>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}

function CodeBlock({ file, code }: { file: string; code: string }) {
  return (
    <div className="bg-gray-950 rounded-xl overflow-hidden mb-4">
      <div className="px-4 py-2 border-b border-gray-800 text-xs text-gray-500">{file}</div>
      <pre className="p-4 text-sm text-gray-300 overflow-x-auto">{code}</pre>
    </div>
  )
}

function KeyRow({ label, value, copied, onCopy, secret }: {
  label: string; value: string; copied: string; onCopy: (v: string, l: string) => void; secret?: boolean
}) {
  const [revealed, setRevealed] = useState(false)
  const display = secret && !revealed ? value.slice(0, 10) + '...' + '*'.repeat(20) : value

  return (
    <div className="flex items-center gap-3 border border-gray-200 rounded-lg px-4 py-3">
      <span className="text-sm text-gray-500 shrink-0 w-32">{label}</span>
      <code className="text-sm text-gray-800 font-mono flex-1 truncate">{display}</code>
      {secret && (
        <button onClick={() => setRevealed(!revealed)} className="text-xs text-gray-400 hover:text-gray-700 shrink-0">
          {revealed ? 'Hide' : 'Reveal'}
        </button>
      )}
      <button onClick={() => onCopy(value, label)} className="text-gray-400 hover:text-gray-700 shrink-0">
        {copied === label ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
      </button>
    </div>
  )
}
