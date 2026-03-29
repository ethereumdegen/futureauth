import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router'
import { signOut, type AuthUser } from '../lib/auth-client'
import { listProjects, type Project } from '../lib/api'
import { Phone, Plus, LogOut, ChevronRight, Mail, Key, BookOpen } from 'lucide-react'

export default function Dashboard({ user, onSignOut }: { user: AuthUser; onSignOut: () => void }) {
  const navigate = useNavigate()
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    listProjects().then(setProjects).finally(() => setLoading(false))
  }, [])

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
            <span className="text-sm text-gray-500">{user.email}</span>
            <Link
              to="/docs"
              className="text-gray-400 hover:text-gray-700 p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
              title="Docs"
            >
              <BookOpen size={16} />
            </Link>
            <Link
              to="/settings"
              className="text-gray-400 hover:text-gray-700 p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
              title="API Keys"
            >
              <Key size={16} />
            </Link>
            <button
              onClick={() => signOut().then(() => { onSignOut(); navigate('/sign-in'); })}
              className="text-gray-400 hover:text-gray-700 p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-6 py-10">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Projects</h1>
          <Link
            to="/projects/new"
            className="flex items-center gap-2 bg-gray-900 hover:bg-gray-800 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            <Plus size={16} /> New Project
          </Link>
        </div>

        {loading ? (
          <div className="text-gray-400 text-center py-12">Loading...</div>
        ) : projects.length === 0 ? (
          <div className="text-center py-20 border border-gray-200 rounded-2xl">
            <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center mx-auto mb-4">
              <Phone size={24} className="text-gray-400" />
            </div>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">No projects yet</h2>
            <p className="text-gray-500 mb-6 text-sm">Create a project to start adding OTP auth to your app.</p>
            <Link
              to="/projects/new"
              className="inline-flex items-center gap-2 bg-gray-900 hover:bg-gray-800 text-white px-5 py-2.5 rounded-lg text-sm font-medium transition-colors"
            >
              <Plus size={16} /> Create Project
            </Link>
          </div>
        ) : (
          <div className="space-y-2">
            {projects.map((p) => (
              <Link
                key={p.id}
                to={`/projects/${p.id}`}
                className="flex items-center justify-between border border-gray-200 rounded-xl px-5 py-4 hover:border-gray-300 hover:shadow-sm transition-all group"
              >
                <div className="flex items-center gap-4">
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${
                    p.otp_mode === 'email' ? 'bg-purple-50 text-purple-600' : 'bg-blue-50 text-blue-600'
                  }`}>
                    {p.otp_mode === 'email' ? <Mail size={16} /> : <Phone size={16} />}
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">{p.name}</h3>
                    <p className="text-xs text-gray-400 mt-0.5 font-mono">{p.publishable_key}</p>
                  </div>
                </div>
                <ChevronRight size={18} className="text-gray-300 group-hover:text-gray-500 transition-colors" />
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
