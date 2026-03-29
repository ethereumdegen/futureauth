import { useState, useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router'
import { getSession, type AuthUser } from './lib/auth-client'
import Landing from './pages/Landing'
import SignIn from './pages/SignIn'
import Dashboard from './pages/Dashboard'
import ProjectDetail from './pages/ProjectDetail'
import NewProject from './pages/NewProject'
import Settings from './pages/Settings'
import Docs from './pages/Docs'

export default function App() {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getSession()
      .then(data => setUser(data?.user ?? null))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!user) {
    return (
      <Routes>
        <Route path="/sign-in" element={<SignIn onAuth={setUser} />} />
        <Route path="*" element={<Landing />} />
      </Routes>
    )
  }

  return (
    <Routes>
      <Route path="/" element={<Dashboard user={user} onSignOut={() => setUser(null)} />} />
      <Route path="/projects/new" element={<NewProject />} />
      <Route path="/projects/:id" element={<ProjectDetail />} />
      <Route path="/docs" element={<Docs />} />
      <Route path="/settings" element={<Settings />} />
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  )
}
