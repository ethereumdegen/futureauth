import { useState, useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router'
import { getSession, type AuthUser } from './lib/auth-client'
import Landing from './pages/Landing'
import SignIn from './pages/SignIn'
import AuthVerify from './pages/AuthVerify'
import Dashboard from './pages/Dashboard'
import ProjectDetail from './pages/ProjectDetail'
import NewProject from './pages/NewProject'
import Settings from './pages/Settings'
import Docs from './pages/Docs'
import Admin from './pages/Admin'

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

  return (
    <Routes>
      <Route path="/" element={<Landing user={user} onSignOut={() => setUser(null)} />} />
      <Route path="/dashboard" element={user ? <Dashboard user={user} onSignOut={() => setUser(null)} /> : <Navigate to="/sign-in" />} />
      <Route path="/projects/new" element={user ? <NewProject /> : <Navigate to="/sign-in" />} />
      <Route path="/projects/:id" element={user ? <ProjectDetail /> : <Navigate to="/sign-in" />} />
      <Route path="/settings" element={user ? <Settings /> : <Navigate to="/sign-in" />} />
      <Route path="/admin" element={user ? <Admin /> : <Navigate to="/sign-in" />} />
      <Route path="/sign-in" element={<SignIn onAuth={setUser} />} />
      <Route path="/auth/verify" element={<AuthVerify onAuth={setUser} />} />
      <Route path="/docs" element={<Docs />} />
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  )
}
