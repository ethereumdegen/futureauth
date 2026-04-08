const BASE = '/api'

async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...options.headers },
  })
  if (res.status === 401) {
    window.location.href = '/sign-in'
    throw new Error('Unauthorized')
  }
  if (res.status === 204) return undefined as T
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error || `API error: ${res.status}`)
  }
  return res.json()
}

export type OtpMode = 'phone' | 'email'

export interface Project {
  id: string
  name: string
  otp_mode: OtpMode
  secret_key?: string  // only returned on creation/regeneration
  created_at: string
  updated_at?: string
}

export interface AppConfig {
  sms_enabled: boolean
  email_enabled: boolean
  stripe_enabled: boolean
}

export const getConfig = () => apiFetch<AppConfig>('/config')

export const listProjects = () => apiFetch<Project[]>('/projects')

export const createProject = (data: {
  name: string
  otp_mode?: OtpMode
}) => apiFetch<Project>('/projects', { method: 'POST', body: JSON.stringify(data) })

export const getProject = (id: string) => apiFetch<Project>(`/projects/${id}`)

export const updateProject = (id: string, data: Record<string, unknown>) =>
  apiFetch<Project>(`/projects/${id}`, { method: 'PUT', body: JSON.stringify(data) })

export const deleteProject = (id: string) =>
  apiFetch<void>(`/projects/${id}`, { method: 'DELETE' })

export const regenerateProjectKeys = (id: string) =>
  apiFetch<Project>(`/projects/${id}/regenerate-keys`, { method: 'POST' })

// --- Project Logs ---

export interface OtpLogEntry {
  id: string
  event: string
  email: string
  ip: string | null
  success: boolean
  created_at: string
}

export interface LogsResponse {
  logs: OtpLogEntry[]
  total: number
}

export const getProjectLogs = (id: string, limit = 50, offset = 0) =>
  apiFetch<LogsResponse>(`/projects/${id}/logs?limit=${limit}&offset=${offset}`)

// --- Developer API Keys ---

export interface ApiKey {
  id: string
  name: string
  key?: string
  key_prefix: string
  created_at: string
  last_used_at?: string
}

export const listApiKeys = () => apiFetch<ApiKey[]>('/keys')

export const createApiKey = (name: string) =>
  apiFetch<ApiKey>('/keys', { method: 'POST', body: JSON.stringify({ name }) })

export const deleteApiKey = (id: string) =>
  apiFetch<void>(`/keys/${id}`, { method: 'DELETE' })

// --- Billing ---

export interface BillingInfo {
  plan: string
  usage_today: number
  daily_limit: number
  stripe_enabled: boolean
  has_subscription: boolean
}

export const getProjectBilling = (id: string) =>
  apiFetch<BillingInfo>(`/projects/${id}/billing`)

export const createCheckoutSession = (id: string) =>
  apiFetch<{ url: string }>(`/projects/${id}/billing/checkout`, { method: 'POST' })

export const createPortalSession = (id: string) =>
  apiFetch<{ url: string }>(`/projects/${id}/billing/portal`, { method: 'POST' })

// --- Admin ---

export interface AdminOverview {
  total_projects: number
  total_users: number
  plans: { free: number; pro: number }
  today_total_usage: number
}

export interface AdminProject {
  id: string
  name: string
  owner_email: string
  plan: string
  usage_today: number
}

export interface AdminConfig {
  email_enabled: boolean
  sms_enabled: boolean
  stripe_enabled: boolean
  stripe_secret_key_set: boolean
  stripe_webhook_secret_set: boolean
  stripe_price_id_set: boolean
  admin_emails_count: number
}

export const getAdminOverview = () => apiFetch<AdminOverview>('/admin/overview')
export const getAdminProjects = () => apiFetch<{ projects: AdminProject[] }>('/admin/projects')
export const getAdminConfig = () => apiFetch<AdminConfig>('/admin/config')
