export interface User {
  id: string
  email: string | null
  phone_number: string | null
  name: string
  email_verified: boolean
  phone_number_verified: boolean
  metadata: Record<string, unknown>
  created_at: Date
  updated_at: Date
}

export interface Session {
  id: string
  user_id: string
  token: string
  expires_at: Date
  ip_address: string | null
  user_agent: string | null
  created_at: Date
}

export interface Verification {
  id: string
  identifier: string
  code: string
  expires_at: Date
  attempts: number
  created_at: Date
  kind: string
}

export type OtpChannel = 'email' | 'sms'
