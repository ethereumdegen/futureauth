import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router'
import { getProject, getProjectUsers, getProjectSessions, type Project, type ProjectUser, type ProjectSession } from '../lib/api'
import { ArrowLeft, Copy, Check, Users, Activity, Code, Phone, Mail } from 'lucide-react'

export default function ProjectDetail() {
  const { id } = useParams()
  const [project, setProject] = useState<Project | null>(null)
  const [users, setUsers] = useState<ProjectUser[]>([])
  const [sessions, setSessions] = useState<ProjectSession[]>([])
  const [tab, setTab] = useState<'setup' | 'users' | 'sessions'>('setup')
  const [copied, setCopied] = useState('')

  useEffect(() => {
    if (!id) return
    getProject(id).then(setProject)
    getProjectUsers(id).then(setUsers).catch(() => {})
    getProjectSessions(id).then(setSessions).catch(() => {})
  }, [id])

  function copy(text: string, label: string) {
    navigator.clipboard.writeText(text)
    setCopied(label)
    setTimeout(() => setCopied(''), 2000)
  }

  if (!project) {
    return <div className="min-h-screen bg-white flex items-center justify-center text-gray-400">Loading...</div>
  }

  const isPhone = project.auth_mode === 'phone'
  const vixauthUrl = window.location.origin.replace(':5180', ':3002')

  const authClientCode = isPhone
    ? `import { createAuthClient } from "better-auth/react";
import { phoneNumberClient } from "better-auth/client/plugins";

export const authClient = createAuthClient({
  baseURL: window.location.origin, // proxied to VixAuth
  plugins: [phoneNumberClient()],
});

export const { useSession, signOut } = authClient;`
    : `import { createAuthClient } from "better-auth/react";
import { emailOTPClient } from "better-auth/client/plugins";

export const authClient = createAuthClient({
  baseURL: window.location.origin, // proxied to VixAuth
  plugins: [emailOTPClient()],
});

export const { useSession, signOut } = authClient;`

  const signInCode = isPhone
    ? `// Step 1: Send OTP
await authClient.phoneNumber.sendVerificationCode({
  phoneNumber: "+15551234567",
});

// Step 2: Verify code
await authClient.phoneNumber.verifyPhoneNumber({
  phoneNumber: "+15551234567",
  code: "123456",
});`
    : `// Step 1: Send OTP
await authClient.emailOtp.sendVerificationOtp({
  email: "user@example.com",
  type: "sign-in",
});

// Step 2: Verify code
await authClient.emailOtp.verifyEmail({
  email: "user@example.com",
  otp: "123456",
});`

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
        <div className="flex items-center gap-3 mb-1">
          <h1 className="text-2xl font-bold text-gray-900">{project.name}</h1>
          <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${
            isPhone ? 'bg-blue-50 text-blue-700' : 'bg-purple-50 text-purple-700'
          }`}>
            {isPhone ? <Phone size={10} /> : <Mail size={10} />}
            {isPhone ? 'Phone OTP' : 'Email OTP'}
          </span>
        </div>
        <p className="text-gray-400 text-sm font-mono mb-8">{project.publishable_key}</p>

        {/* Tabs */}
        <div className="flex gap-1 border border-gray-200 rounded-lg p-1 mb-8 w-fit">
          {([['setup', 'Setup', Code], ['users', 'Users', Users], ['sessions', 'Sessions', Activity]] as const).map(([key, label, Icon]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                tab === key ? 'bg-gray-100 text-gray-900' : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              <Icon size={14} /> {label}
            </button>
          ))}
        </div>

        {/* Setup Tab */}
        {tab === 'setup' && (
          <div className="space-y-8">
            <section>
              <h2 className="text-sm font-semibold text-gray-900 mb-3 uppercase tracking-wider">API Keys</h2>
              <div className="space-y-2">
                <KeyRow label="Publishable Key" value={project.publishable_key} copied={copied} onCopy={copy} />
                {project.secret_key && (
                  <KeyRow label="Secret Key" value={project.secret_key} copied={copied} onCopy={copy} secret />
                )}
              </div>
            </section>

            <section>
              <h2 className="text-sm font-semibold text-gray-900 mb-3 uppercase tracking-wider">Frontend Auth Client</h2>
              <CodeBlock file="src/lib/auth-client.ts" code={authClientCode} />
            </section>

            <section>
              <h2 className="text-sm font-semibold text-gray-900 mb-3 uppercase tracking-wider">Vite Proxy</h2>
              <CodeBlock file="vite.config.ts" code={`server: {
  proxy: {
    '/api/auth': {
      target: '${vixauthUrl}',
      rewrite: (path) => \`/auth/${project.publishable_key}\${path}\`,
    },
  },
}`} />
            </section>

            <section>
              <h2 className="text-sm font-semibold text-gray-900 mb-3 uppercase tracking-wider">Sign-In Flow</h2>
              <CodeBlock file={`${isPhone ? 'Phone' : 'Email'} OTP`} code={signInCode} />
            </section>

            <section>
              <h2 className="text-sm font-semibold text-gray-900 mb-3 uppercase tracking-wider">Backend Session Check</h2>
              <CodeBlock file="SQL — reads from YOUR database" code={`SELECT u.* FROM session s
JOIN "user" u ON u.id = s.user_id
WHERE s.token = $1 AND s.expires_at > NOW();`} />
            </section>
          </div>
        )}

        {/* Users Tab */}
        {tab === 'users' && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wider">Users ({users.length})</h2>
            </div>
            {users.length === 0 ? (
              <div className="text-center py-16 border border-gray-200 rounded-xl">
                <Users size={32} className="text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500 text-sm">No users yet. They'll appear after the first sign-in.</p>
              </div>
            ) : (
              <div className="border border-gray-200 rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 bg-gray-50 text-gray-500 text-left">
                      <th className="px-4 py-3 font-medium">{isPhone ? 'Phone' : 'Email'}</th>
                      <th className="px-4 py-3 font-medium">Name</th>
                      <th className="px-4 py-3 font-medium">Verified</th>
                      <th className="px-4 py-3 font-medium">Joined</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((u) => (
                      <tr key={u.id} className="border-b border-gray-100 last:border-0">
                        <td className="px-4 py-3 font-mono text-gray-700">{(isPhone ? u.phone_number : u.email) || '-'}</td>
                        <td className="px-4 py-3 text-gray-700">{u.name || '-'}</td>
                        <td className="px-4 py-3">
                          {(isPhone ? u.phone_number_verified : u.email_verified)
                            ? <span className="inline-flex items-center gap-1 text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full text-xs font-medium"><Check size={10} /> Yes</span>
                            : <span className="text-gray-400 text-xs">No</span>}
                        </td>
                        <td className="px-4 py-3 text-gray-500">{new Date(u.created_at).toLocaleDateString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Sessions Tab */}
        {tab === 'sessions' && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wider">Active Sessions ({sessions.length})</h2>
            </div>
            {sessions.length === 0 ? (
              <div className="text-center py-16 border border-gray-200 rounded-xl">
                <Activity size={32} className="text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500 text-sm">No active sessions.</p>
              </div>
            ) : (
              <div className="border border-gray-200 rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 bg-gray-50 text-gray-500 text-left">
                      <th className="px-4 py-3 font-medium">User</th>
                      <th className="px-4 py-3 font-medium">IP</th>
                      <th className="px-4 py-3 font-medium">Created</th>
                      <th className="px-4 py-3 font-medium">Expires</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sessions.map((s) => (
                      <tr key={s.id} className="border-b border-gray-100 last:border-0">
                        <td className="px-4 py-3 font-mono text-gray-700">{s.phone_number || s.email || s.name || s.user_id.slice(0, 12)}</td>
                        <td className="px-4 py-3 text-gray-500">{s.ip_address || '-'}</td>
                        <td className="px-4 py-3 text-gray-500">{new Date(s.created_at).toLocaleString()}</td>
                        <td className="px-4 py-3 text-gray-500">{new Date(s.expires_at).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function CodeBlock({ file, code }: { file: string; code: string }) {
  return (
    <div className="bg-gray-950 rounded-xl overflow-hidden">
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
