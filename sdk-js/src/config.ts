export interface FutureAuthConfig {
  /** FutureAuth server URL (default: "https://future-auth.com") */
  apiUrl: string
  /** Project secret key (vx_sec_...) */
  secretKey: string
  /** Project name for branding in emails/SMS */
  projectName: string
  /** Session TTL in seconds (default: 30 days) */
  sessionTtlSeconds: number
  /** OTP TTL in seconds (default: 2 minutes) */
  otpTtlSeconds: number
  /** OTP code length (default: 6) */
  otpLength: number
  /** Session cookie name (default: "futureauth_session") */
  cookieName: string
  /** Magic link TTL in seconds (default: 15 minutes) */
  magicLinkTtlSeconds: number
}

export const defaultConfig: FutureAuthConfig = {
  apiUrl: 'https://future-auth.com',
  secretKey: '',
  projectName: '',
  sessionTtlSeconds: 30 * 24 * 60 * 60, // 30 days
  otpTtlSeconds: 2 * 60,                 // 2 minutes
  otpLength: 6,
  cookieName: 'futureauth_session',
  magicLinkTtlSeconds: 15 * 60,          // 15 minutes
}
