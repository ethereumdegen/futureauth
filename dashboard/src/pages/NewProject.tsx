import { useState } from 'react'
import { useNavigate, Link } from 'react-router'
import { createProject } from '../lib/api'
import { Phone, ArrowLeft } from 'lucide-react'

export default function NewProject() {
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [databaseUrl, setDatabaseUrl] = useState('')
  const [twilioSid, setTwilioSid] = useState('')
  const [twilioToken, setTwilioToken] = useState('')
  const [twilioPhone, setTwilioPhone] = useState('')
  const [allowedOrigins, setAllowedOrigins] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const project = await createProject({
        name,
        database_url: databaseUrl,
        twilio_account_sid: twilioSid || undefined,
        twilio_auth_token: twilioToken || undefined,
        twilio_phone_number: twilioPhone || undefined,
        allowed_origins: allowedOrigins
          ? allowedOrigins.split(',').map(s => s.trim()).filter(Boolean)
          : undefined,
      })
      navigate(`/projects/${project.id}`)
    } catch (e: any) {
      setError(e.message || 'Failed to create project')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <nav className="border-b border-gray-800/50">
        <div className="max-w-2xl mx-auto px-6 py-4">
          <Link to="/" className="flex items-center gap-2 text-gray-400 hover:text-white text-sm transition-colors">
            <ArrowLeft size={16} /> Back to projects
          </Link>
        </div>
      </nav>

      <div className="max-w-2xl mx-auto px-6 py-10">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 bg-emerald-600 rounded-xl flex items-center justify-center">
            <Phone size={20} />
          </div>
          <h1 className="text-2xl font-bold">New Project</h1>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm rounded-lg px-4 py-3 mb-6">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Project Name</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Octaweave"
              className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">NeonDB URL</label>
            <input
              type="text"
              required
              value={databaseUrl}
              onChange={(e) => setDatabaseUrl(e.target.value)}
              placeholder="postgres://user:pass@ep-xxx.us-east-2.aws.neon.tech/dbname?sslmode=require"
              className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500 font-mono text-sm"
            />
            <p className="text-xs text-gray-500 mt-1">Auth tables (user, session, account, verification) will be auto-created.</p>
          </div>

          <div className="border-t border-gray-800 pt-6">
            <h2 className="text-lg font-semibold mb-4">Twilio SMS <span className="text-gray-500 text-sm font-normal">(optional for dev)</span></h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Account SID</label>
                <input
                  type="text"
                  value={twilioSid}
                  onChange={(e) => setTwilioSid(e.target.value)}
                  placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                  className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500 font-mono text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Auth Token</label>
                <input
                  type="password"
                  value={twilioToken}
                  onChange={(e) => setTwilioToken(e.target.value)}
                  placeholder="Your Twilio auth token"
                  className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Phone Number</label>
                <input
                  type="text"
                  value={twilioPhone}
                  onChange={(e) => setTwilioPhone(e.target.value)}
                  placeholder="+15551234567"
                  className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500 font-mono text-sm"
                />
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-2">Without Twilio, OTP codes are logged to the server console (dev mode).</p>
          </div>

          <div className="border-t border-gray-800 pt-6">
            <label className="block text-sm font-medium text-gray-300 mb-2">Allowed Origins <span className="text-gray-500 font-normal">(comma-separated)</span></label>
            <input
              type="text"
              value={allowedOrigins}
              onChange={(e) => setAllowedOrigins(e.target.value)}
              placeholder="http://localhost:5173, https://myapp.com"
              className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500 text-sm"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white py-3 rounded-lg font-medium transition-colors"
          >
            {loading ? 'Creating...' : 'Create Project'}
          </button>
        </form>
      </div>
    </div>
  )
}
