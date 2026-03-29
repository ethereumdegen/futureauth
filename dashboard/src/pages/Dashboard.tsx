import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router'
import { signOut, useSession } from '../lib/auth-client'
import { listProjects, type Project } from '../lib/api'
import { Phone, Plus, LogOut, ChevronRight } from 'lucide-react'

export default function Dashboard() {
  const { data: session } = useSession()
  const navigate = useNavigate()
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    listProjects().then(setProjects).finally(() => setLoading(false))
  }, [])

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <nav className="border-b border-gray-800/50">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-emerald-600 rounded-lg flex items-center justify-center">
              <Phone size={16} />
            </div>
            <span className="text-xl font-bold">VixAuth</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-400">{session?.user?.email}</span>
            <button
              onClick={() => signOut().then(() => navigate('/sign-in'))}
              className="text-gray-500 hover:text-white p-1.5 rounded-lg hover:bg-gray-800 transition-colors"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-6 py-10">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-bold">Projects</h1>
          <Link
            to="/projects/new"
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            <Plus size={16} /> New Project
          </Link>
        </div>

        {loading ? (
          <div className="text-gray-500 text-center py-12">Loading...</div>
        ) : projects.length === 0 ? (
          <div className="text-center py-20 bg-gray-900 rounded-2xl border border-gray-800">
            <Phone size={40} className="text-gray-600 mx-auto mb-4" />
            <h2 className="text-lg font-semibold text-gray-300 mb-2">No projects yet</h2>
            <p className="text-gray-500 mb-6 text-sm">Create your first project to start adding phone auth to your app.</p>
            <Link
              to="/projects/new"
              className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-5 py-2.5 rounded-lg text-sm font-medium transition-colors"
            >
              <Plus size={16} /> Create Project
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {projects.map((p) => (
              <Link
                key={p.id}
                to={`/projects/${p.id}`}
                className="flex items-center justify-between bg-gray-900 border border-gray-800 rounded-xl px-5 py-4 hover:border-gray-700 transition-colors group"
              >
                <div>
                  <h3 className="font-semibold text-white">{p.name}</h3>
                  <p className="text-xs text-gray-500 mt-1 font-mono">{p.publishable_key}</p>
                </div>
                <ChevronRight size={18} className="text-gray-600 group-hover:text-gray-400 transition-colors" />
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
