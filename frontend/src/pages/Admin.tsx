import { useState, useEffect } from 'react'
import { Link } from 'react-router'
import { ArrowLeft, Check, X } from 'lucide-react'
import {
  getAdminOverview,
  getAdminProjects,
  getAdminConfig,
  type AdminOverview,
  type AdminProject,
  type AdminConfig,
} from '../lib/api'

export default function Admin() {
  const [overview, setOverview] = useState<AdminOverview | null>(null)
  const [projects, setProjects] = useState<AdminProject[]>([])
  const [config, setConfig] = useState<AdminConfig | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    Promise.all([
      getAdminOverview(),
      getAdminProjects(),
      getAdminConfig(),
    ])
      .then(([ov, pr, cfg]) => {
        setOverview(ov)
        setProjects(pr.projects)
        setConfig(cfg)
      })
      .catch(e => setError(e.message))
  }, [])

  if (error) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 text-lg font-medium mb-2">Access Denied</p>
          <p className="text-gray-500 text-sm">{error}</p>
          <Link to="/dashboard" className="text-sm text-gray-500 hover:text-gray-900 mt-4 inline-block">Back to Dashboard</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white">
      <nav className="border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center gap-4">
          <Link to="/dashboard" className="flex items-center gap-2 text-gray-500 hover:text-gray-900 text-sm transition-colors">
            <ArrowLeft size={16} /> Dashboard
          </Link>
          <span className="text-gray-300">/</span>
          <span className="text-sm font-semibold text-gray-900">Admin</span>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-6 py-10 space-y-10">
        {/* Overview Cards */}
        {overview && (
          <section>
            <h2 className="text-sm font-semibold text-gray-900 mb-4 uppercase tracking-wider">Overview</h2>
            <div className="grid grid-cols-4 gap-4">
              <StatCard label="Total Projects" value={overview.total_projects} />
              <StatCard label="Total Users" value={overview.total_users} />
              <StatCard label="Free Plans" value={overview.plans.free} />
              <StatCard label="Pro Plans" value={overview.plans.pro} color="text-emerald-600" />
            </div>
            <div className="mt-4">
              <StatCard label="OTPs Sent Today (all projects)" value={overview.today_total_usage} />
            </div>
          </section>
        )}

        {/* Projects Table */}
        <section>
          <h2 className="text-sm font-semibold text-gray-900 mb-4 uppercase tracking-wider">All Projects</h2>
          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 text-gray-500 font-medium">Name</th>
                  <th className="text-left px-4 py-3 text-gray-500 font-medium">Owner</th>
                  <th className="text-left px-4 py-3 text-gray-500 font-medium">Plan</th>
                  <th className="text-left px-4 py-3 text-gray-500 font-medium">Usage Today</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {projects.length === 0 ? (
                  <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-400">No projects</td></tr>
                ) : projects.map(p => (
                  <tr key={p.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <Link to={`/projects/${p.id}`} className="text-gray-900 hover:underline font-medium">{p.name}</Link>
                    </td>
                    <td className="px-4 py-3 text-gray-500 font-mono text-xs">{p.owner_email}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex text-xs font-bold px-2 py-0.5 rounded-full ${
                        p.plan === 'pro' ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-600'
                      }`}>
                        {p.plan}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-700">{p.usage_today}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Config Status */}
        {config && (
          <section>
            <h2 className="text-sm font-semibold text-gray-900 mb-4 uppercase tracking-wider">Configuration</h2>
            <div className="border border-gray-200 rounded-lg divide-y divide-gray-100">
              <ConfigRow label="Email (Resend)" enabled={config.email_enabled} />
              <ConfigRow label="SMS (Twilio)" enabled={config.sms_enabled} />
              <ConfigRow label="Stripe Billing" enabled={config.stripe_enabled} />
              <ConfigRow label="Stripe Secret Key" enabled={config.stripe_secret_key_set} />
              <ConfigRow label="Stripe Webhook Secret" enabled={config.stripe_webhook_secret_set} />
              <ConfigRow label="Stripe Price ID" enabled={config.stripe_price_id_set} />
              <div className="flex items-center justify-between px-4 py-3">
                <span className="text-sm text-gray-700">Admin Emails</span>
                <span className="text-sm text-gray-500">{config.admin_emails_count} configured</span>
              </div>
            </div>
          </section>
        )}
      </div>
    </div>
  )
}

function StatCard({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <div className="border border-gray-200 rounded-lg p-4">
      <p className="text-sm text-gray-500">{label}</p>
      <p className={`text-2xl font-bold ${color || 'text-gray-900'}`}>{value}</p>
    </div>
  )
}

function ConfigRow({ label, enabled }: { label: string; enabled: boolean }) {
  return (
    <div className="flex items-center justify-between px-4 py-3">
      <span className="text-sm text-gray-700">{label}</span>
      {enabled ? (
        <span className="inline-flex items-center gap-1 text-emerald-600 text-xs font-medium">
          <Check size={14} /> Configured
        </span>
      ) : (
        <span className="inline-flex items-center gap-1 text-gray-400 text-xs">
          <X size={14} /> Not set
        </span>
      )}
    </div>
  )
}
