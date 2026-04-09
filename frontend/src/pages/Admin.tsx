import { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router'
import { ArrowLeft, Check, X, Copy, Search, ChevronLeft, ChevronRight } from 'lucide-react'
import {
  getAdminOverview,
  getAdminProjects,
  getAdminConfig,
  getAdminLogs,
  type AdminOverview,
  type AdminProject,
  type AdminConfig,
  type AdminLogEntry,
} from '../lib/api'
import { usePageSEO } from '../lib/seo'

export default function Admin() {
  usePageSEO({ pageTitle: 'Admin', canonicalPath: '/admin', noindex: true })
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
          <div className="border border-gray-200 rounded-lg overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 text-gray-500 font-medium">Name</th>
                  <th className="text-left px-4 py-3 text-gray-500 font-medium">Owner</th>
                  <th className="text-left px-4 py-3 text-gray-500 font-medium">Plan</th>
                  <th className="text-left px-4 py-3 text-gray-500 font-medium">Usage</th>
                  <th className="text-left px-4 py-3 text-gray-500 font-medium">Stripe</th>
                  <th className="text-left px-4 py-3 text-gray-500 font-medium">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {projects.length === 0 ? (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">No projects</td></tr>
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
                    <td className="px-4 py-3 text-xs">
                      <StripeCell
                        customerId={p.stripe_customer_id}
                        subscriptionId={p.stripe_subscription_id}
                      />
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">
                      {new Date(p.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Global Logs Viewer */}
        <LogsSection projects={projects} />

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

function StripeCell({ customerId, subscriptionId }: {
  customerId: string | null
  subscriptionId: string | null
}) {
  const [copied, setCopied] = useState('')
  function copy(val: string, label: string) {
    navigator.clipboard.writeText(val)
    setCopied(label)
    setTimeout(() => setCopied(''), 1500)
  }
  if (!customerId && !subscriptionId) {
    return <span className="text-gray-300">—</span>
  }
  return (
    <div className="space-y-1 font-mono">
      {customerId && (
        <button
          onClick={() => copy(customerId, 'cus')}
          className="flex items-center gap-1 text-gray-600 hover:text-gray-900"
          title="Click to copy customer ID"
        >
          <span className="truncate max-w-[140px]">{customerId}</span>
          {copied === 'cus' ? <Check size={10} className="text-emerald-600" /> : <Copy size={10} />}
        </button>
      )}
      {subscriptionId && (
        <button
          onClick={() => copy(subscriptionId, 'sub')}
          className="flex items-center gap-1 text-emerald-700 hover:text-emerald-900"
          title="Click to copy subscription ID"
        >
          <span className="truncate max-w-[140px]">{subscriptionId}</span>
          {copied === 'sub' ? <Check size={10} className="text-emerald-600" /> : <Copy size={10} />}
        </button>
      )}
    </div>
  )
}

function LogsSection({ projects }: { projects: AdminProject[] }) {
  const [logs, setLogs] = useState<AdminLogEntry[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(0)
  const [projectId, setProjectId] = useState('')
  const [event, setEvent] = useState('')
  const [successFilter, setSuccessFilter] = useState<'' | 'true' | 'false'>('')
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const pageSize = 50

  const projectNameById = useMemo(() => {
    const m: Record<string, string> = {}
    projects.forEach(p => { m[p.id] = p.name })
    return m
  }, [projects])

  useEffect(() => {
    setLoading(true)
    getAdminLogs({
      limit: pageSize,
      offset: page * pageSize,
      project_id: projectId || undefined,
      event: event || undefined,
      success: successFilter === '' ? undefined : successFilter === 'true',
      search: search || undefined,
    })
      .then(res => {
        setLogs(res.logs)
        setTotal(res.total)
      })
      .finally(() => setLoading(false))
  }, [page, projectId, event, successFilter, search])

  // Reset page when filters change
  useEffect(() => { setPage(0) }, [projectId, event, successFilter, search])

  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  return (
    <section>
      <h2 className="text-sm font-semibold text-gray-900 mb-4 uppercase tracking-wider">Global Logs</h2>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-3">
        <select
          value={projectId}
          onChange={e => setProjectId(e.target.value)}
          className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white"
        >
          <option value="">All projects</option>
          {projects.map(p => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>

        <select
          value={event}
          onChange={e => setEvent(e.target.value)}
          className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white"
        >
          <option value="">All events</option>
          <option value="send">OTP Email</option>
          <option value="send_sms">OTP SMS</option>
          <option value="send_magic_link">Magic Link</option>
        </select>

        <select
          value={successFilter}
          onChange={e => setSuccessFilter(e.target.value as '' | 'true' | 'false')}
          className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white"
        >
          <option value="">All statuses</option>
          <option value="true">Delivered</option>
          <option value="false">Failed</option>
        </select>

        <form
          onSubmit={e => { e.preventDefault(); setSearch(searchInput) }}
          className="flex items-center gap-1 flex-1 min-w-[200px]"
        >
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              placeholder="Search email..."
              className="w-full text-sm border border-gray-200 rounded-lg pl-9 pr-3 py-1.5"
            />
          </div>
          {(search || searchInput) && (
            <button
              type="button"
              onClick={() => { setSearch(''); setSearchInput('') }}
              className="text-xs text-gray-400 hover:text-gray-700 px-2"
            >
              Clear
            </button>
          )}
        </form>
      </div>

      <div className="text-xs text-gray-500 mb-2">
        {loading ? 'Loading...' : `${total} events`}
      </div>

      {/* Logs Table */}
      <div className="border border-gray-200 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 text-gray-500 font-medium">Event</th>
              <th className="text-left px-4 py-3 text-gray-500 font-medium">Project</th>
              <th className="text-left px-4 py-3 text-gray-500 font-medium">Email</th>
              <th className="text-left px-4 py-3 text-gray-500 font-medium">IP</th>
              <th className="text-left px-4 py-3 text-gray-500 font-medium">Status</th>
              <th className="text-left px-4 py-3 text-gray-500 font-medium">Time</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">Loading...</td></tr>
            ) : logs.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">No events match these filters.</td></tr>
            ) : logs.map(log => (
              <tr key={log.id} className="hover:bg-gray-50">
                <td className="px-4 py-3"><EventBadge event={log.event} /></td>
                <td className="px-4 py-3 text-gray-700">
                  {log.project_id ? (
                    <Link to={`/projects/${log.project_id}`} className="hover:underline">
                      {log.project_name || projectNameById[log.project_id] || log.project_id.slice(0, 8)}
                    </Link>
                  ) : (
                    <span className="text-gray-400 italic">dashboard</span>
                  )}
                </td>
                <td className="px-4 py-3 font-mono text-gray-700 truncate max-w-[200px]">{log.email}</td>
                <td className="px-4 py-3 font-mono text-gray-500 text-xs">{log.ip || '—'}</td>
                <td className="px-4 py-3">
                  {log.success ? (
                    <span className="inline-flex items-center gap-1 text-emerald-700 text-xs font-medium">
                      <Check size={12} /> Delivered
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-red-600 text-xs font-medium">
                      Failed
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">{formatTime(log.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-3">
          <p className="text-xs text-gray-500">
            Page {page + 1} of {totalPages}
          </p>
          <div className="flex gap-1">
            <button
              onClick={() => setPage(p => p - 1)}
              disabled={page === 0}
              className="flex items-center gap-1 px-2 py-1 text-xs border border-gray-200 rounded disabled:opacity-40 hover:bg-gray-50"
            >
              <ChevronLeft size={12} /> Prev
            </button>
            <button
              onClick={() => setPage(p => p + 1)}
              disabled={page >= totalPages - 1}
              className="flex items-center gap-1 px-2 py-1 text-xs border border-gray-200 rounded disabled:opacity-40 hover:bg-gray-50"
            >
              Next <ChevronRight size={12} />
            </button>
          </div>
        </div>
      )}
    </section>
  )
}

function EventBadge({ event }: { event: string }) {
  const config: Record<string, { label: string; color: string }> = {
    send: { label: 'OTP Email', color: 'bg-purple-50 text-purple-700' },
    send_sms: { label: 'OTP SMS', color: 'bg-blue-50 text-blue-700' },
    send_magic_link: { label: 'Magic Link', color: 'bg-indigo-50 text-indigo-700' },
  }
  const c = config[event] || { label: event, color: 'bg-gray-100 text-gray-600' }
  return (
    <span className={`inline-flex text-xs font-medium px-2 py-0.5 rounded-full ${c.color}`}>
      {c.label}
    </span>
  )
}

function formatTime(iso: string) {
  const d = new Date(iso)
  const now = new Date()
  const diff = now.getTime() - d.getTime()
  if (diff < 60_000) return 'just now'
  if (diff < 3600_000) return `${Math.floor(diff / 60_000)}m ago`
  if (diff < 86400_000) return `${Math.floor(diff / 3600_000)}h ago`
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
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
