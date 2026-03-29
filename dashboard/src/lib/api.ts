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

export interface Project {
  id: string
  name: string
  publishable_key: string
  secret_key?: string
  database_url?: string
  twilio_account_sid?: string
  twilio_phone_number?: string
  allowed_origins?: string[]
  created_at: string
  updated_at?: string
}

export interface ProjectUser {
  id: string
  name?: string
  email?: string
  phoneNumber?: string
  phoneNumberVerified?: boolean
  createdAt: string
}

export interface ProjectSession {
  id: string
  userId: string
  phoneNumber?: string
  name?: string
  ipAddress?: string
  userAgent?: string
  createdAt: string
  expiresAt: string
}

export const listProjects = () => apiFetch<Project[]>('/projects')

export const createProject = (data: {
  name: string
  database_url: string
  twilio_account_sid?: string
  twilio_auth_token?: string
  twilio_phone_number?: string
  allowed_origins?: string[]
}) => apiFetch<Project>('/projects', { method: 'POST', body: JSON.stringify(data) })

export const getProject = (id: string) => apiFetch<Project>(`/projects/${id}`)

export const updateProject = (id: string, data: Record<string, unknown>) =>
  apiFetch<Project>(`/projects/${id}`, { method: 'PUT', body: JSON.stringify(data) })

export const deleteProject = (id: string) =>
  apiFetch<void>(`/projects/${id}`, { method: 'DELETE' })

export const getProjectUsers = (id: string) =>
  apiFetch<ProjectUser[]>(`/projects/${id}/users`)

export const getProjectSessions = (id: string) =>
  apiFetch<ProjectSession[]>(`/projects/${id}/sessions`)
