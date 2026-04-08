import { useState } from 'react'
import { sendMagicLink, type AuthUser } from '../lib/auth-client'
import { Shield, Mail } from 'lucide-react'

export default function SignIn({ onAuth: _onAuth }: { onAuth: (user: AuthUser) => void }) {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSend(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const res = await sendMagicLink(email)
      if (res.error) {
        setError(res.error)
      } else {
        setSent(true)
      }
    } catch {
      setError('Failed to send sign-in link')
    } finally {
      setLoading(false)
    }
  }

  async function handleResend() {
    setLoading(true)
    setError('')
    try {
      const res = await sendMagicLink(email)
      if (res.error) {
        setError(res.error)
      }
    } catch {
      setError('Failed to resend link')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-12 h-12 bg-emerald-600 rounded-xl flex items-center justify-center mx-auto mb-4">
            <Shield size={24} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Sign in to FutureAuth</h1>
          <p className="text-gray-500 text-sm mt-1">We'll email you a sign-in link</p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3 mb-4">
            {error}
          </div>
        )}

        <div className="bg-white border border-gray-200 rounded-xl p-6">
          {!sent ? (
            <form onSubmit={handleSend} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-gray-900 hover:bg-gray-800 disabled:opacity-40 text-white py-2.5 rounded-lg font-medium transition-colors"
              >
                {loading ? 'Sending...' : 'Send Sign-In Link'}
              </button>
            </form>
          ) : (
            <div className="text-center space-y-4">
              <Mail size={32} className="text-emerald-600 mx-auto" />
              <div>
                <p className="text-sm text-gray-600">
                  We sent a sign-in link to
                </p>
                <p className="font-medium text-gray-900">{email}</p>
              </div>
              <p className="text-xs text-gray-400">Check your inbox and click the link to sign in. The link expires in 15 minutes.</p>
              <button
                type="button"
                onClick={handleResend}
                disabled={loading}
                className="text-emerald-600 hover:text-emerald-700 text-sm font-medium disabled:opacity-40"
              >
                {loading ? 'Resending...' : 'Resend link'}
              </button>
              <div>
                <button
                  type="button"
                  onClick={() => { setSent(false); setError(''); }}
                  className="text-gray-500 hover:text-gray-700 text-sm transition-colors"
                >
                  Use a different email
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
