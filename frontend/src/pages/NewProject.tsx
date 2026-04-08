import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router'
import { createProject, getConfig, type OtpMode } from '../lib/api'
import { ArrowLeft, Phone, Mail } from 'lucide-react'

export default function NewProject() {
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [otpMode, setOtpMode] = useState<OtpMode>('email')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [smsEnabled, setSmsEnabled] = useState(false)

  useEffect(() => {
    getConfig().then((c) => setSmsEnabled(c.sms_enabled))
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const project = await createProject({ name, otp_mode: otpMode })
      navigate(`/projects/${project.id}`, { state: { secret_key: project.secret_key } })
    } catch (e: any) {
      setError(e.message || 'Failed to create project')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-white">
      <nav className="border-b border-gray-200">
        <div className="max-w-2xl mx-auto px-6 py-4">
          <Link to="/dashboard" className="flex items-center gap-2 text-gray-500 hover:text-gray-900 text-sm transition-colors">
            <ArrowLeft size={16} /> Back to projects
          </Link>
        </div>
      </nav>

      <div className="max-w-2xl mx-auto px-6 py-10">
        <h1 className="text-2xl font-bold text-gray-900 mb-8">New Project</h1>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3 mb-6">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-8">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Project Name</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Octaweave"
              className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">OTP Mode</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => smsEnabled && setOtpMode('phone')}
                disabled={!smsEnabled}
                className={`flex items-center gap-3 p-4 rounded-xl border-2 transition-all text-left ${
                  !smsEnabled
                    ? 'border-gray-100 bg-gray-50 opacity-50 cursor-not-allowed'
                    : otpMode === 'phone'
                    ? 'border-emerald-500 bg-emerald-50 ring-1 ring-emerald-500/20'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                  otpMode === 'phone' ? 'bg-emerald-600 text-white' : 'bg-gray-100 text-gray-400'
                }`}>
                  <Phone size={18} />
                </div>
                <div>
                  <div className={`font-medium text-sm ${otpMode === 'phone' ? 'text-emerald-900' : 'text-gray-900'}`}>
                    Phone OTP
                  </div>
                  <div className="text-xs text-gray-500">{smsEnabled ? 'SMS via Twilio' : 'Twilio not configured'}</div>
                </div>
              </button>
              <button
                type="button"
                onClick={() => setOtpMode('email')}
                className={`flex items-center gap-3 p-4 rounded-xl border-2 transition-all text-left ${
                  otpMode === 'email'
                    ? 'border-emerald-500 bg-emerald-50 ring-1 ring-emerald-500/20'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                  otpMode === 'email' ? 'bg-emerald-600 text-white' : 'bg-gray-100 text-gray-400'
                }`}>
                  <Mail size={18} />
                </div>
                <div>
                  <div className={`font-medium text-sm ${otpMode === 'email' ? 'text-emerald-900' : 'text-gray-900'}`}>
                    Email OTP
                  </div>
                  <div className="text-xs text-gray-500">Email via Resend</div>
                </div>
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gray-900 hover:bg-gray-800 disabled:opacity-40 text-white py-3 rounded-lg font-medium transition-colors"
          >
            {loading ? 'Creating...' : 'Create Project'}
          </button>
        </form>
      </div>
    </div>
  )
}
