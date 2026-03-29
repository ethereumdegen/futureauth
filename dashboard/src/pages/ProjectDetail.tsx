import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router'
import { getProject, getProjectUsers, getProjectSessions, type Project, type ProjectUser, type ProjectSession } from '../lib/api'
import { ArrowLeft, Copy, Check, Users, Activity, Code } from 'lucide-react'

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
    return <div className="min-h-screen bg-gray-950 flex items-center justify-center text-gray-500">Loading...</div>
  }

  const vixauthUrl = window.location.origin.replace(':5180', ':3002')

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <nav className="border-b border-gray-800/50">
        <div className="max-w-4xl mx-auto px-6 py-4">
          <Link to="/" className="flex items-center gap-2 text-gray-400 hover:text-white text-sm transition-colors">
            <ArrowLeft size={16} /> Back to projects
          </Link>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-6 py-10">
        <h1 className="text-2xl font-bold mb-2">{project.name}</h1>
        <p className="text-gray-500 text-sm font-mono mb-8">{project.publishable_key}</p>

        {/* Tabs */}
        <div className="flex gap-1 bg-gray-900 rounded-lg p-1 mb-8 w-fit">
          {([['setup', 'Setup', Code], ['users', 'Users', Users], ['sessions', 'Sessions', Activity]] as const).map(([key, label, Icon]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                tab === key ? 'bg-gray-800 text-white' : 'text-gray-400 hover:text-white'
              }`}
            >
              <Icon size={14} /> {label}
            </button>
          ))}
        </div>

        {/* Setup Tab */}
        {tab === 'setup' && (
          <div className="space-y-8">
            {/* Keys */}
            <section>
              <h2 className="text-lg font-semibold mb-4">API Keys</h2>
              <div className="space-y-3">
                <KeyRow label="Publishable Key" value={project.publishable_key} copied={copied} onCopy={copy} />
                {project.secret_key && (
                  <KeyRow label="Secret Key" value={project.secret_key} copied={copied} onCopy={copy} secret />
                )}
              </div>
            </section>

            {/* Integration Guide */}
            <section>
              <h2 className="text-lg font-semibold mb-4">Frontend Integration</h2>
              <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
                <div className="px-4 py-2 border-b border-gray-800 text-xs text-gray-500">src/lib/auth-client.ts</div>
                <pre className="p-4 text-sm text-gray-300 overflow-x-auto">{`import { createAuthClient } from "better-auth/react";
import { phoneNumberClient } from "better-auth/client/plugins";

export const authClient = createAuthClient({
  baseURL: window.location.origin, // proxied to VixAuth
  plugins: [phoneNumberClient()],
});

export const { useSession, signOut } = authClient;`}</pre>
              </div>
            </section>

            <section>
              <h2 className="text-lg font-semibold mb-4">Vite Proxy Config</h2>
              <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
                <div className="px-4 py-2 border-b border-gray-800 text-xs text-gray-500">vite.config.ts</div>
                <pre className="p-4 text-sm text-gray-300 overflow-x-auto">{`server: {
  proxy: {
    '/api/auth': {
      target: '${vixauthUrl}',
      rewrite: (path) => \`/auth/${project.publishable_key}\${path}\`,
    },
  },
}`}</pre>
              </div>
            </section>

            <section>
              <h2 className="text-lg font-semibold mb-4">Sign-In Page</h2>
              <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
                <div className="px-4 py-2 border-b border-gray-800 text-xs text-gray-500">src/pages/SignIn.tsx</div>
                <pre className="p-4 text-sm text-gray-300 overflow-x-auto">{`import { authClient } from '../lib/auth-client';

// Step 1: Send OTP
await authClient.phoneNumber.sendVerificationCode({
  phoneNumber: "+15551234567",
});

// Step 2: Verify code
const result = await authClient.phoneNumber.verifyPhoneNumber({
  phoneNumber: "+15551234567",
  code: "123456",
});`}</pre>
              </div>
            </section>

            <section>
              <h2 className="text-lg font-semibold mb-4">Backend Session Check</h2>
              <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
                <div className="px-4 py-2 border-b border-gray-800 text-xs text-gray-500">Your backend reads sessions from your own DB</div>
                <pre className="p-4 text-sm text-gray-300 overflow-x-auto">{`-- Session lives in YOUR NeonDB. Query it directly:
SELECT u.* FROM "session" s
JOIN "user" u ON u.id = s."userId"
WHERE s.token = $1 AND s."expiresAt" > NOW();`}</pre>
              </div>
            </section>
          </div>
        )}

        {/* Users Tab */}
        {tab === 'users' && (
          <div>
            <h2 className="text-lg font-semibold mb-4">Users ({users.length})</h2>
            {users.length === 0 ? (
              <p className="text-gray-500 text-sm py-8 text-center">No users yet. They'll appear here after the first sign-in.</p>
            ) : (
              <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-800 text-gray-500 text-left">
                      <th className="px-4 py-3 font-medium">Phone</th>
                      <th className="px-4 py-3 font-medium">Name</th>
                      <th className="px-4 py-3 font-medium">Verified</th>
                      <th className="px-4 py-3 font-medium">Joined</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((u) => (
                      <tr key={u.id} className="border-b border-gray-800/50 last:border-0">
                        <td className="px-4 py-3 font-mono text-gray-300">{u.phoneNumber || '-'}</td>
                        <td className="px-4 py-3 text-gray-300">{u.name || '-'}</td>
                        <td className="px-4 py-3">
                          {u.phoneNumberVerified
                            ? <span className="text-emerald-400 text-xs">Verified</span>
                            : <span className="text-gray-500 text-xs">No</span>}
                        </td>
                        <td className="px-4 py-3 text-gray-500">{new Date(u.createdAt).toLocaleDateString()}</td>
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
            <h2 className="text-lg font-semibold mb-4">Active Sessions ({sessions.length})</h2>
            {sessions.length === 0 ? (
              <p className="text-gray-500 text-sm py-8 text-center">No active sessions.</p>
            ) : (
              <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-800 text-gray-500 text-left">
                      <th className="px-4 py-3 font-medium">User</th>
                      <th className="px-4 py-3 font-medium">IP</th>
                      <th className="px-4 py-3 font-medium">Created</th>
                      <th className="px-4 py-3 font-medium">Expires</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sessions.map((s) => (
                      <tr key={s.id} className="border-b border-gray-800/50 last:border-0">
                        <td className="px-4 py-3 font-mono text-gray-300">{s.phoneNumber || s.name || s.userId}</td>
                        <td className="px-4 py-3 text-gray-500">{s.ipAddress || '-'}</td>
                        <td className="px-4 py-3 text-gray-500">{new Date(s.createdAt).toLocaleString()}</td>
                        <td className="px-4 py-3 text-gray-500">{new Date(s.expiresAt).toLocaleString()}</td>
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

function KeyRow({ label, value, copied, onCopy, secret }: {
  label: string; value: string; copied: string; onCopy: (v: string, l: string) => void; secret?: boolean
}) {
  const [revealed, setRevealed] = useState(false)
  const display = secret && !revealed ? value.slice(0, 10) + '...' + '*'.repeat(20) : value

  return (
    <div className="flex items-center gap-3 bg-gray-900 border border-gray-800 rounded-lg px-4 py-3">
      <span className="text-sm text-gray-400 shrink-0 w-32">{label}</span>
      <code className="text-sm text-gray-300 font-mono flex-1 truncate">{display}</code>
      {secret && (
        <button onClick={() => setRevealed(!revealed)} className="text-xs text-gray-500 hover:text-gray-300 shrink-0">
          {revealed ? 'Hide' : 'Reveal'}
        </button>
      )}
      <button onClick={() => onCopy(value, label)} className="text-gray-500 hover:text-white shrink-0">
        {copied === label ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
      </button>
    </div>
  )
}
