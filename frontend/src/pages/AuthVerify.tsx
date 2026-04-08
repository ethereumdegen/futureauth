import { useState, useEffect } from 'react'
import { useSearchParams, Link } from 'react-router'
import { verifyMagicLink, type AuthUser } from '../lib/auth-client'
import { Shield, CheckCircle, XCircle, Loader2 } from 'lucide-react'

export default function AuthVerify({ onAuth }: { onAuth: (user: AuthUser) => void }) {
  const [searchParams] = useSearchParams()
  const [status, setStatus] = useState<'verifying' | 'success' | 'error'>('verifying')
  const [error, setError] = useState('')

  useEffect(() => {
    const token = searchParams.get('token')
    if (!token) {
      setStatus('error')
      setError('Missing token')
      return
    }

    verifyMagicLink(token)
      .then(res => {
        if (res.error) {
          setStatus('error')
          setError(res.error)
        } else if (res.user) {
          setStatus('success')
          onAuth(res.user)
          setTimeout(() => {
            window.location.href = '/'
          }, 1500)
        }
      })
      .catch(() => {
        setStatus('error')
        setError('Verification failed')
      })
  }, [searchParams, onAuth])

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-sm text-center">
        <div className="w-12 h-12 bg-emerald-600 rounded-xl flex items-center justify-center mx-auto mb-6">
          <Shield size={24} className="text-white" />
        </div>

        {status === 'verifying' && (
          <>
            <Loader2 size={32} className="animate-spin text-emerald-600 mx-auto mb-4" />
            <h1 className="text-xl font-bold text-gray-900">Verifying your link...</h1>
            <p className="text-gray-500 text-sm mt-2">Please wait a moment</p>
          </>
        )}

        {status === 'success' && (
          <>
            <CheckCircle size={32} className="text-emerald-600 mx-auto mb-4" />
            <h1 className="text-xl font-bold text-gray-900">You're signed in!</h1>
            <p className="text-gray-500 text-sm mt-2">Redirecting to dashboard...</p>
          </>
        )}

        {status === 'error' && (
          <>
            <XCircle size={32} className="text-red-500 mx-auto mb-4" />
            <h1 className="text-xl font-bold text-gray-900">Verification failed</h1>
            <p className="text-red-600 text-sm mt-2">{error}</p>
            <Link
              to="/sign-in"
              className="inline-block mt-6 text-emerald-600 hover:text-emerald-700 font-medium text-sm"
            >
              Back to sign in
            </Link>
          </>
        )}
      </div>
    </div>
  )
}
