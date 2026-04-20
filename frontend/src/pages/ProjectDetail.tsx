import { useState, useEffect } from 'react'
import { useParams, Link, useLocation } from 'react-router'
import { getProject, deleteProject, updateProject, regenerateProjectKeys, getProjectLogs, getProjectBilling, createCheckoutSession, createPortalSession, type Project, type OtpLogEntry, type BillingInfo } from '../lib/api'
import { ArrowLeft, Copy, Check, Phone, Mail, Trash2, Code, Pencil, RefreshCw, Home, BarChart3, ChevronDown, ChevronRight } from 'lucide-react'
import { useNavigate } from 'react-router'
import { usePageSEO } from '../lib/seo'

type Tab = 'home' | 'analytics'

export default function ProjectDetail() {
  usePageSEO({ pageTitle: 'Project', noindex: true })
  const { id } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const [project, setProject] = useState<Project | null>(null)
  const [copied, setCopied] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [regenerating, setRegenerating] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editName, setEditName] = useState('')
  const [tab, setTab] = useState<Tab>('home')

  useEffect(() => {
    if (!id) return
    const secretKey = location.state?.secret_key
    getProject(id).then(p => {
      if (secretKey) p.secret_key = secretKey
      setProject(p)
    })
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
      navigate('/dashboard')
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

  async function handleSaveCallbackUrl(url: string) {
    if (!id) return
    const updated = await updateProject(id, { magic_link_callback_url: url || null })
    setProject(updated)
  }

  if (!project) {
    return <div className="min-h-screen bg-white flex items-center justify-center text-gray-400">Loading...</div>
  }

  return (
    <div className="min-h-screen bg-white">
      <nav className="border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/dashboard" className="flex items-center gap-2 text-gray-500 hover:text-gray-900 text-sm transition-colors">
              <ArrowLeft size={16} /> Projects
            </Link>
            <span className="text-gray-300">/</span>
            <div className="flex items-center gap-2">
              {editing ? (
                <form onSubmit={e => { e.preventDefault(); handleRename() }} className="flex items-center gap-2">
                  <input
                    autoFocus
                    value={editName}
                    onChange={e => setEditName(e.target.value)}
                    onKeyDown={e => e.key === 'Escape' && setEditing(false)}
                    className="text-sm font-semibold text-gray-900 border-b-2 border-gray-300 focus:border-gray-900 outline-none bg-transparent"
                  />
                  <button type="submit" className="text-xs text-gray-500 hover:text-gray-900">Save</button>
                  <button type="button" onClick={() => setEditing(false)} className="text-xs text-gray-400 hover:text-gray-600">Cancel</button>
                </form>
              ) : (
                <>
                  <span className="text-sm font-semibold text-gray-900">{project.name}</span>
                  <button onClick={() => { setEditName(project.name); setEditing(true) }} className="text-gray-400 hover:text-gray-700">
                    <Pencil size={12} />
                  </button>
                </>
              )}
            </div>
          </div>
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="flex items-center gap-2 text-gray-400 hover:text-red-600 text-sm transition-colors"
          >
            <Trash2 size={14} /> {deleting ? 'Deleting...' : 'Delete'}
          </button>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto flex">
        {/* Sidebar */}
        <aside className="w-56 shrink-0 border-r border-gray-200 min-h-[calc(100vh-57px)] py-6 px-4">
          <div className="mb-6">
            <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${
              project.otp_mode === 'phone' ? 'bg-blue-50 text-blue-700' : 'bg-purple-50 text-purple-700'
            }`}>
              {project.otp_mode === 'phone' ? <Phone size={10} /> : <Mail size={10} />}
              {project.otp_mode === 'phone' ? 'Phone OTP' : 'Email OTP'}
            </span>
            <p className="text-gray-400 text-xs font-mono mt-2 truncate" title={project.id}>{project.id}</p>
          </div>
          <nav className="space-y-1">
            <SidebarItem icon={<Home size={16} />} label="Home" active={tab === 'home'} onClick={() => setTab('home')} />
            <SidebarItem icon={<BarChart3 size={16} />} label="Analytics" active={tab === 'analytics'} onClick={() => setTab('analytics')} />
          </nav>
        </aside>

        {/* Main content */}
        <main className="flex-1 px-10 py-10 min-w-0">
          {tab === 'home' && (
            <HomeTab
              project={project}
              copied={copied}
              onCopy={copy}
              regenerating={regenerating}
              onRegenerate={handleRegenerateKeys}
              onSaveCallbackUrl={handleSaveCallbackUrl}
            />
          )}
          {tab === 'analytics' && (
            <AnalyticsTab projectId={project.id} />
          )}
        </main>
      </div>
    </div>
  )
}

function SidebarItem({ icon, label, active, onClick }: {
  icon: React.ReactNode; label: string; active: boolean; onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
        active
          ? 'bg-gray-100 text-gray-900 font-medium'
          : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'
      }`}
    >
      {icon}
      {label}
    </button>
  )
}

function BillingSection({ projectId }: { projectId: string }) {
  const [billing, setBilling] = useState<BillingInfo | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getProjectBilling(projectId)
      .then(setBilling)
      .finally(() => setLoading(false))
  }, [projectId])

  if (loading || !billing) return null

  const usagePercent = Math.min(100, Math.round((billing.usage_today / billing.daily_limit) * 100))
  const isPro = billing.plan === 'pro'

  return (
    <section>
      <h2 className="text-sm font-semibold text-gray-900 mb-3 uppercase tracking-wider">Plan & Usage</h2>
      <div className="border border-gray-200 rounded-lg p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className={`inline-flex text-xs font-bold px-2.5 py-1 rounded-full ${
              isPro ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-700'
            }`}>
              {isPro ? 'Pro' : 'Free'}
            </span>
            <span className="text-sm text-gray-500">
              {billing.usage_today} / {billing.daily_limit} unique emails today
            </span>
          </div>
          {billing.stripe_enabled && !isPro && (
            <button
              onClick={async () => {
                const { url } = await createCheckoutSession(projectId)
                window.location.href = url
              }}
              className="text-sm font-medium text-white bg-gray-900 hover:bg-gray-800 px-4 py-1.5 rounded-lg transition-colors"
            >
              Upgrade to Pro
            </button>
          )}
          {isPro && billing.has_subscription && (
            <button
              onClick={async () => {
                const { url } = await createPortalSession(projectId)
                window.location.href = url
              }}
              className="text-sm text-gray-500 hover:text-gray-900 transition-colors"
            >
              Manage Subscription
            </button>
          )}
        </div>
        <div className="w-full bg-gray-100 rounded-full h-2">
          <div
            className={`h-2 rounded-full transition-all ${
              usagePercent > 90 ? 'bg-red-500' : usagePercent > 70 ? 'bg-amber-500' : 'bg-emerald-500'
            }`}
            style={{ width: `${usagePercent}%` }}
          />
        </div>
      </div>
    </section>
  )
}

function HomeTab({ project, copied, onCopy, regenerating, onRegenerate, onSaveCallbackUrl }: {
  project: Project
  copied: string
  onCopy: (v: string, l: string) => void
  regenerating: boolean
  onRegenerate: () => void
  onSaveCallbackUrl: (url: string) => Promise<void>
}) {
  const isPhone = project.otp_mode === 'phone'
  const futureauthUrl = window.location.origin

  const cargoToml = `[dependencies]
futureauth = "0.5"
# Enable Axum integration for auth routes + extractor
# futureauth = { version = "0.5", features = ["axum-integration"] }`

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

// Mount auth routes: /api/auth/send-otp, verify-otp, session, sign-out,
// send-magic-link, verify-magic-link
let app = Router::new()
    .nest("/api/auth", auth_router())
    .route("/api/me", get(me_handler))
    .with_state(futureauth);

async fn me_handler(auth: AuthSession) -> Json<User> {
    Json(auth.user)
}`

  const sendMagicLinkCode = `// Send a magic link via email.
// The link is built as: {magic_link_callback_url}?token=<48-char-token>
// Configure the callback URL in the project settings above.
futureauth.send_magic_link("user@example.com").await?;`

  const verifyMagicLinkCode = `// User clicks the magic link → your callback URL receives ?token=...
// Extract the token and verify it:
let token = req.query("token")?;
let (user, session) = futureauth.verify_magic_link(
    &token,
    Some(ip_address),
    Some(user_agent),
).await?;
// Set session cookie: session.token (then redirect the user to your app)`

  const magicLinkAxumHandler = `// If you use the axum-integration feature, these routes are mounted automatically:
//   POST /api/auth/send-magic-link    { email }
//   POST /api/auth/verify-magic-link  { token }
//
// Your frontend callback page should POST the token from the URL:
async function verifyCallback() {
    const token = new URLSearchParams(location.search).get("token");
    const res = await fetch("/api/auth/verify-magic-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
    });
    if (res.ok) location.href = "/";
}`

  return (
    <div className="max-w-3xl space-y-8">
      {/* API Keys */}
      <section>
        <h2 className="text-sm font-semibold text-gray-900 mb-3 uppercase tracking-wider">Secret Key</h2>
        <div className="space-y-2">
          {project.secret_key && (
            <KeyRow label="Secret Key" value={project.secret_key} copied={copied} onCopy={onCopy} secret />
          )}
          {!project.secret_key && (
            <div className="text-xs text-gray-400 mt-1">
              Secret key was shown on creation only.
            </div>
          )}
          <button
            onClick={onRegenerate}
            disabled={regenerating}
            className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900 mt-2 transition-colors"
          >
            <RefreshCw size={14} className={regenerating ? 'animate-spin' : ''} />
            {regenerating ? 'Regenerating...' : 'Regenerate Keys'}
          </button>
        </div>
      </section>

      {/* Magic Link Callback URL */}
      <CallbackUrlSection
        initialValue={project.magic_link_callback_url || ''}
        onSave={onSaveCallbackUrl}
      />

      {/* Billing */}
      <BillingSection projectId={project.id} />

      {/* SDK Setup — collapsed by default */}
      <Accordion title="SDK Integration & Setup Instructions" icon={<Code size={14} />}>
        <div className="space-y-8 pt-4">
          <section>
            <h3 className="text-sm font-semibold text-gray-900 mb-3 uppercase tracking-wider">Cargo.toml</h3>
            <CodeBlock file="Cargo.toml" code={cargoToml} />
          </section>

          <section>
            <h3 className="text-sm font-semibold text-gray-900 mb-3 uppercase tracking-wider">Initialize</h3>
            <CodeBlock file="src/main.rs" code={rustSetup} />
          </section>

          <section>
            <h3 className="text-sm font-semibold text-gray-900 mb-3 uppercase tracking-wider">Send OTP</h3>
            <CodeBlock file={isPhone ? 'Phone OTP' : 'Email OTP'} code={sendOtpCode} />
          </section>

          <section>
            <h3 className="text-sm font-semibold text-gray-900 mb-3 uppercase tracking-wider">Verify OTP</h3>
            <CodeBlock file="Verify & create session" code={verifyCode} />
            <div className="border-l-2 border-amber-400 bg-amber-50 text-amber-800 px-4 py-3 rounded-r-lg text-sm mt-2 mb-4">
              <strong>Important:</strong> Add brute-force protection on your verify endpoint. Use escalating delays
              after each failed attempt (e.g., 0s → 30s → 60s → 5min → invalidate code).
              Without attempt limits, an attacker could make unlimited guesses. See the{' '}
              <Link to="/docs#brute-force" className="underline font-medium">docs</Link> for a full example.
            </div>
          </section>

          <section>
            <h3 className="text-sm font-semibold text-gray-900 mb-3 uppercase tracking-wider">Session Check</h3>
            <CodeBlock file="Validate authenticated requests" code={sessionCheck} />
          </section>

          <section>
            <h3 className="text-sm font-semibold text-gray-900 mb-3 uppercase tracking-wider">Axum Routes (optional)</h3>
            <p className="text-sm text-gray-500 mb-3">
              Enable the <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs">axum-integration</code> feature for pre-built auth routes and extractors.
            </p>
            <CodeBlock file="With axum-integration feature" code={axumRoutes} />
          </section>

          <section className="border-t border-gray-200 pt-6">
            <h3 className="text-sm font-semibold text-gray-900 mb-3 uppercase tracking-wider">Magic Link Authentication</h3>
            <p className="text-sm text-gray-500 mb-3">
              As an alternative to OTP codes, you can send a one-click magic link via email. Make sure you've set a
              <strong> Magic Link Callback URL </strong> above — FutureAuth appends{' '}
              <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs">?token=...</code> to it when sending the email.
              {!project.magic_link_callback_url && (
                <span className="block mt-2 text-amber-700">
                  ⚠ No callback URL configured. Magic links will return a 400 error until you set one.
                </span>
              )}
            </p>

            <div className="text-xs text-gray-500 mb-1">1. Send the magic link</div>
            <CodeBlock file="Send magic link" code={sendMagicLinkCode} />

            <div className="text-xs text-gray-500 mb-1 mt-4">2. Verify the token on your callback page</div>
            <CodeBlock file="Verify magic link" code={verifyMagicLinkCode} />

            <div className="text-xs text-gray-500 mb-1 mt-4">3. (Optional) Use the built-in Axum routes</div>
            <CodeBlock file="axum-integration feature" code={magicLinkAxumHandler} />

            <div className="border-l-2 border-indigo-400 bg-indigo-50 text-indigo-800 px-4 py-3 rounded-r-lg text-sm mt-4">
              <strong>How the flow works:</strong> <code className="bg-white/60 px-1 rounded">send_magic_link</code>{' '}
              generates a 48-char token, stores it in <em>your</em> verification table (15-minute TTL), then calls
              FutureAuth to deliver the email. When the user clicks the link, your callback URL receives{' '}
              <code className="bg-white/60 px-1 rounded">?token=...</code>, and{' '}
              <code className="bg-white/60 px-1 rounded">verify_magic_link</code> creates a session in your database.
              FutureAuth never stores user data — everything lives in your Postgres.
            </div>
          </section>

          <section className="border-t border-gray-200 pt-6">
            <h3 className="text-sm font-semibold text-gray-900 mb-3 uppercase tracking-wider">How it works</h3>
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
      </Accordion>
    </div>
  )
}

function CallbackUrlSection({ initialValue, onSave }: {
  initialValue: string
  onSave: (url: string) => Promise<void>
}) {
  const [value, setValue] = useState(initialValue)
  const [saving, setSaving] = useState(false)
  const [savedAt, setSavedAt] = useState(0)
  const dirty = value !== initialValue

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!dirty || saving) return
    setSaving(true)
    try {
      await onSave(value.trim())
      setSavedAt(Date.now())
    } finally {
      setSaving(false)
    }
  }

  return (
    <section>
      <h2 className="text-sm font-semibold text-gray-900 mb-3 uppercase tracking-wider">Magic Link Callback URL</h2>
      <p className="text-sm text-gray-500 mb-3">
        When you send a magic link via this project, FutureAuth will append <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs">?token=...</code> to this URL.
        Required to send magic links.
      </p>
      <form onSubmit={handleSave} className="flex items-center gap-2">
        <input
          type="url"
          value={value}
          onChange={e => setValue(e.target.value)}
          placeholder="https://yourapp.com/auth/verify"
          className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-2 font-mono text-gray-800 focus:border-gray-900 focus:outline-none"
        />
        <button
          type="submit"
          disabled={!dirty || saving}
          className="text-sm font-medium text-white bg-gray-900 hover:bg-gray-800 disabled:bg-gray-300 px-4 py-2 rounded-lg transition-colors"
        >
          {saving ? 'Saving...' : 'Save'}
        </button>
      </form>
      {savedAt > 0 && !dirty && (
        <p className="text-xs text-emerald-600 mt-2">Saved.</p>
      )}
    </section>
  )
}

function Accordion({ title, icon, children }: {
  title: string
  icon?: React.ReactNode
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(false)
  return (
    <section className="border border-gray-200 rounded-lg">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-50 transition-colors"
      >
        <span className="flex items-center gap-2 text-sm font-semibold text-gray-900 uppercase tracking-wider">
          {icon}
          {title}
        </span>
        {open ? <ChevronDown size={16} className="text-gray-400" /> : <ChevronRight size={16} className="text-gray-400" />}
      </button>
      {open && (
        <div className="px-4 pb-4 border-t border-gray-100">
          {children}
        </div>
      )}
    </section>
  )
}

function AnalyticsTab({ projectId }: { projectId: string }) {
  const [logs, setLogs] = useState<OtpLogEntry[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(0)
  const pageSize = 25

  useEffect(() => {
    setLoading(true)
    getProjectLogs(projectId, pageSize, page * pageSize).then(res => {
      setLogs(res.logs)
      setTotal(res.total)
    }).finally(() => setLoading(false))
  }, [projectId, page])

  const totalPages = Math.ceil(total / pageSize)

  // Compute summary stats
  const sendEvents = logs.filter(l => l.event === 'send' || l.event === 'send_magic_link' || l.event === 'send_sms')
  const successCount = sendEvents.filter(l => l.success).length
  const failCount = sendEvents.filter(l => !l.success).length

  return (
    <div className="max-w-4xl">
      <h2 className="text-xl font-bold text-gray-900 mb-6">Analytics</h2>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="border border-gray-200 rounded-lg p-4">
          <p className="text-sm text-gray-500">Total Events</p>
          <p className="text-2xl font-bold text-gray-900">{total}</p>
        </div>
        <div className="border border-gray-200 rounded-lg p-4">
          <p className="text-sm text-gray-500">Delivered (this page)</p>
          <p className="text-2xl font-bold text-emerald-600">{successCount}</p>
        </div>
        <div className="border border-gray-200 rounded-lg p-4">
          <p className="text-sm text-gray-500">Failed (this page)</p>
          <p className="text-2xl font-bold text-red-600">{failCount}</p>
        </div>
      </div>

      {/* Logs table */}
      <div className="border border-gray-200 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 text-gray-500 font-medium">Event</th>
              <th className="text-left px-4 py-3 text-gray-500 font-medium">Email</th>
              <th className="text-left px-4 py-3 text-gray-500 font-medium">Status</th>
              <th className="text-left px-4 py-3 text-gray-500 font-medium">Time</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-400">Loading...</td></tr>
            ) : logs.length === 0 ? (
              <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-400">No events yet. Logs appear when your app sends OTPs or magic links through this project.</td></tr>
            ) : logs.map(log => (
              <tr key={log.id} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <EventBadge event={log.event} />
                </td>
                <td className="px-4 py-3 font-mono text-gray-700 truncate max-w-[200px]">{log.email}</td>
                <td className="px-4 py-3">
                  {log.success ? (
                    <span className="inline-flex items-center gap-1 text-emerald-700 text-xs font-medium">
                      <Check size={12} /> Delivered
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-red-600 text-xs font-medium">
                      Failed
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-gray-500">{formatTime(log.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-sm text-gray-500">
            Page {page + 1} of {totalPages} ({total} total)
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setPage(p => p - 1)}
              disabled={page === 0}
              className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50 transition-colors"
            >
              Previous
            </button>
            <button
              onClick={() => setPage(p => p + 1)}
              disabled={page >= totalPages - 1}
              className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50 transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function EventBadge({ event }: { event: string }) {
  const config: Record<string, { label: string; color: string }> = {
    send: { label: 'OTP Email', color: 'bg-purple-50 text-purple-700' },
    send_sms: { label: 'OTP SMS', color: 'bg-blue-50 text-blue-700' },
    send_magic_link: { label: 'Magic Link', color: 'bg-indigo-50 text-indigo-700' },
  }
  const c = config[event] || { label: event, color: 'bg-gray-100 text-gray-600' }
  return (
    <span className={`inline-flex text-xs font-medium px-2 py-0.5 rounded-full ${c.color}`}>
      {c.label}
    </span>
  )
}

function formatTime(iso: string) {
  const d = new Date(iso)
  const now = new Date()
  const diff = now.getTime() - d.getTime()

  if (diff < 60_000) return 'just now'
  if (diff < 3600_000) return `${Math.floor(diff / 60_000)}m ago`
  if (diff < 86400_000) return `${Math.floor(diff / 3600_000)}h ago`

  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
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
