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
  publishable_key: string
  secret_key?: string  // only returned on creation
  created_at: string
  updated_at?: string
}

export interface AppConfig {
  sms_enabled: boolean
  email_enabled: boolean
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
