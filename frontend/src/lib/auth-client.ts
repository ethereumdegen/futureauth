// FutureAuth dashboard auth — no more BetterAuth dependency

const BASE = '/api/auth'

export interface AuthUser {
  id: string
  email: string
  name: string
}

interface SessionData {
  user: AuthUser
}

export async function sendOtp(email: string): Promise<{ ok?: boolean; error?: string }> {
  const res = await fetch(`${BASE}/send-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ email }),
  })
  return res.json()
}

export async function verifyOtp(email: string, code: string): Promise<{ user?: AuthUser; error?: string }> {
  const res = await fetch(`${BASE}/verify-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ email, code }),
  })
  return res.json()
}

export async function sendMagicLink(email: string): Promise<{ ok?: boolean; error?: string }> {
  const res = await fetch(`${BASE}/send-magic-link`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ email }),
  })
  return res.json()
}

export async function verifyMagicLink(token: string): Promise<{ user?: AuthUser; error?: string }> {
  const res = await fetch(`${BASE}/verify-magic-link`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ token }),
  })
  return res.json()
}

export async function getSession(): Promise<SessionData | null> {
  try {
    const res = await fetch(`${BASE}/session`, { credentials: 'include' })
    if (!res.ok) return null
    return res.json()
  } catch {
    return null
  }
}

export async function signOut(): Promise<void> {
  await fetch(`${BASE}/sign-out`, { method: 'POST', credentials: 'include' })
}
