import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router'
import { signOut } from '../lib/auth-client'
import { listApiKeys, createApiKey, deleteApiKey, type ApiKey } from '../lib/api'
import { ArrowLeft, Plus, Trash2, Copy, Check, Key, LogOut, Phone } from 'lucide-react'

export default function Settings() {
  const navigate = useNavigate()
  const [keys, setKeys] = useState<ApiKey[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [newKeyName, setNewKeyName] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [justCreated, setJustCreated] = useState<ApiKey | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    listApiKeys().then(setKeys).finally(() => setLoading(false))
  }, [])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setCreating(true)
    try {
      const key = await createApiKey(newKeyName || 'Untitled')
      setJustCreated(key)
      setKeys((prev) => [key, ...prev])
      setNewKeyName('')
      setShowCreate(false)
    } finally {
      setCreating(false)
    }
  }

  async function handleDelete(id: string) {
    await deleteApiKey(id)
    setKeys((prev) => prev.filter((k) => k.id !== id))
    if (justCreated?.id === id) setJustCreated(null)
  }

  function copyKey(text: string) {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="min-h-screen bg-white">
      <nav className="border-b border-gray-200 sticky top-0 bg-white/80 backdrop-blur-xl z-10">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-emerald-600 rounded-lg flex items-center justify-center">
              <Phone size={14} className="text-white" />
            </div>
            <span className="text-lg font-bold text-gray-900">FutureAuth</span>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={() => signOut().then(() => navigate('/sign-in'))}
              className="text-gray-400 hover:text-gray-700 p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-6 py-10">
        <div className="mb-2">
          <Link to="/" className="flex items-center gap-2 text-gray-500 hover:text-gray-900 text-sm transition-colors">
            <ArrowLeft size={16} /> Back to projects
          </Link>
        </div>

        <h1 className="text-2xl font-bold text-gray-900 mt-6 mb-8">API Keys</h1>
        <p className="text-gray-500 text-sm mb-6">
          Use API keys to manage your projects programmatically. Include the key as a Bearer token in the Authorization header.
        </p>

        {/* Just-created key banner */}
        {justCreated?.key && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 mb-6">
            <p className="text-sm font-medium text-emerald-800 mb-2">
              API key created — copy it now, it won't be shown again
            </p>
            <div className="flex items-center gap-2">
              <code className="text-sm font-mono bg-white border border-emerald-200 rounded-lg px-3 py-2 flex-1 text-emerald-900 select-all">
                {justCreated.key}
              </code>
              <button
                onClick={() => copyKey(justCreated.key!)}
                className="bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-1"
              >
                {copied ? <Check size={14} /> : <Copy size={14} />}
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
          </div>
        )}

        {/* Create form */}
        {showCreate ? (
          <form onSubmit={handleCreate} className="flex items-end gap-3 mb-6">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Key Name</label>
              <input
                type="text"
                value={newKeyName}
                onChange={(e) => setNewKeyName(e.target.value)}
                placeholder="e.g. CI/CD, CLI"
                autoFocus
                className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-sm"
              />
            </div>
            <button
              type="submit"
              disabled={creating}
              className="bg-gray-900 hover:bg-gray-800 disabled:opacity-40 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-colors"
            >
              {creating ? 'Creating...' : 'Create'}
            </button>
            <button
              type="button"
              onClick={() => setShowCreate(false)}
              className="text-gray-400 hover:text-gray-700 px-3 py-2.5 text-sm transition-colors"
            >
              Cancel
            </button>
          </form>
        ) : (
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 bg-gray-900 hover:bg-gray-800 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors mb-6"
          >
            <Plus size={16} /> New API Key
          </button>
        )}

        {/* Key list */}
        {loading ? (
          <div className="text-gray-400 text-center py-12">Loading...</div>
        ) : keys.length === 0 ? (
          <div className="text-center py-16 border border-gray-200 rounded-xl">
            <Key size={32} className="text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 text-sm">No API keys yet.</p>
          </div>
        ) : (
          <div className="border border-gray-200 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50 text-gray-500 text-left">
                  <th className="px-4 py-3 font-medium">Name</th>
                  <th className="px-4 py-3 font-medium">Key</th>
                  <th className="px-4 py-3 font-medium">Created</th>
                  <th className="px-4 py-3 font-medium">Last Used</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {keys.map((k) => (
                  <tr key={k.id} className="border-b border-gray-100 last:border-0">
                    <td className="px-4 py-3 text-gray-900 font-medium">{k.name}</td>
                    <td className="px-4 py-3 font-mono text-gray-500">{k.key_prefix}</td>
                    <td className="px-4 py-3 text-gray-500">{new Date(k.created_at).toLocaleDateString()}</td>
                    <td className="px-4 py-3 text-gray-500">{k.last_used_at ? new Date(k.last_used_at).toLocaleDateString() : 'Never'}</td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => handleDelete(k.id)}
                        className="text-gray-400 hover:text-red-600 p-1 rounded transition-colors"
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Usage example */}
        <div className="mt-10">
          <h2 className="text-sm font-semibold text-gray-900 mb-3 uppercase tracking-wider">Usage</h2>
          <div className="bg-gray-950 rounded-xl overflow-hidden">
            <div className="px-4 py-2 border-b border-gray-800 text-xs text-gray-500">curl</div>
            <pre className="p-4 text-sm text-gray-300 overflow-x-auto">{`curl -H "Authorization: Bearer vxk_your_key_here" \\
  ${window.location.origin}/api/projects`}</pre>
          </div>
        </div>
      </div>
    </div>
  )
}
