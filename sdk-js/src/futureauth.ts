import type { Pool } from 'pg'
import type { FutureAuthConfig } from './config.js'
import { defaultConfig } from './config.js'
import type { User, Session, OtpChannel } from './types.js'
import { FutureAuthError } from './errors.js'
import { ensureTables } from './db/migrations.js'
import * as userDb from './db/user.js'
import * as sessionDb from './db/session.js'
import * as verificationDb from './db/verification.js'
import { sendOtpToServer, sendMagicLinkToServer } from './client.js'

const OTP_CHARSET = 'abcdefghijklmnopqrstuvwxyz0123456789'

function generateOtp(length: number): string {
  const bytes = new Uint8Array(length)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, b => OTP_CHARSET[b % OTP_CHARSET.length]).join('')
}

export class FutureAuth {
  public readonly pool: Pool
  public readonly config: FutureAuthConfig

  constructor(pool: Pool, config: Partial<FutureAuthConfig> & Pick<FutureAuthConfig, 'secretKey'>) {
    this.pool = pool
    this.config = { ...defaultConfig, ...config }
  }

  /** Create auth tables if they don't exist. Safe to call on every startup. */
  async ensureTables(): Promise<void> {
    await ensureTables(this.pool)
  }

  /** Send OTP code via email or SMS. */
  async sendOtp(channel: OtpChannel, destination: string): Promise<void> {
    const code = generateOtp(this.config.otpLength)
    await verificationDb.create(this.pool, destination, code, this.config.otpTtlSeconds)
    await sendOtpToServer(
      this.config.apiUrl,
      this.config.secretKey,
      channel,
      destination,
      code,
      this.config.projectName,
    )
  }

  /** Verify OTP code. Returns user and session on success. */
  async verifyOtp(
    identifier: string,
    code: string,
    ip?: string,
    ua?: string,
  ): Promise<{ user: User; session: Session }> {
    await verificationDb.verify(this.pool, identifier, code)

    const user = identifier.includes('@')
      ? await userDb.findOrCreateByEmail(this.pool, identifier)
      : await userDb.findOrCreateByPhone(this.pool, identifier)

    const session = await sessionDb.create(
      this.pool, user.id, this.config.sessionTtlSeconds, ip, ua,
    )

    return { user, session }
  }

  /** Validate a session token. Returns user and session if valid, null otherwise. */
  async getSession(token: string): Promise<{ user: User; session: Session } | null> {
    const session = await sessionDb.findByToken(this.pool, token)
    if (!session) return null

    const user = await userDb.findById(this.pool, session.user_id)
    if (!user) return null

    return { user, session }
  }

  /** Revoke a single session. */
  async revokeSession(token: string): Promise<void> {
    await sessionDb.revoke(this.pool, token)
  }

  /** Revoke all sessions for a user. */
  async revokeAllSessions(userId: string): Promise<void> {
    await sessionDb.revokeAll(this.pool, userId)
  }

  /** Send a magic link via email. */
  async sendMagicLink(destination: string): Promise<void> {
    const { nanoid } = await import('nanoid')
    const token = nanoid(48)
    await verificationDb.createMagicLink(
      this.pool, destination, token, this.config.magicLinkTtlSeconds,
    )
    await sendMagicLinkToServer(
      this.config.apiUrl,
      this.config.secretKey,
      destination,
      token,
      this.config.projectName,
    )
  }

  /** Verify a magic link token. Returns user and session on success. */
  async verifyMagicLink(
    token: string,
    ip?: string,
    ua?: string,
  ): Promise<{ user: User; session: Session }> {
    const identifier = await verificationDb.verifyMagicLink(this.pool, token)

    const user = identifier.includes('@')
      ? await userDb.findOrCreateByEmail(this.pool, identifier)
      : await userDb.findOrCreateByPhone(this.pool, identifier)

    const session = await sessionDb.create(
      this.pool, user.id, this.config.sessionTtlSeconds, ip, ua,
    )

    return { user, session }
  }

  /** Remove expired sessions and verification codes. */
  async cleanupExpired(): Promise<{ sessions: number; verifications: number }> {
    const [sessions, verifications] = await Promise.all([
      sessionDb.cleanupExpired(this.pool),
      verificationDb.cleanupExpired(this.pool),
    ])
    return { sessions, verifications }
  }

  /** Look up a user by ID. */
  async getUser(id: string): Promise<User | null> {
    return userDb.findById(this.pool, id)
  }

  /** Look up a user by email. */
  async getUserByEmail(email: string): Promise<User | null> {
    return userDb.findByEmail(this.pool, email)
  }

  /** Update a user's display name. */
  async updateUserName(userId: string, name: string): Promise<User> {
    return userDb.updateName(this.pool, userId, name)
  }

  /** Replace user metadata entirely. */
  async setUserMetadata(userId: string, metadata: Record<string, unknown>): Promise<User> {
    return userDb.setMetadata(this.pool, userId, metadata)
  }

  /** Shallow-merge a patch into user metadata. */
  async mergeUserMetadata(userId: string, patch: Record<string, unknown>): Promise<User> {
    return userDb.mergeMetadata(this.pool, userId, patch)
  }
}
