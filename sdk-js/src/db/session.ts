import type { Pool } from 'pg'
import { nanoid } from 'nanoid'
import type { Session } from '../types.js'

function rowToSession(row: Record<string, unknown>): Session {
  return {
    id: row.id as string,
    user_id: row.user_id as string,
    token: row.token as string,
    expires_at: new Date(row.expires_at as string),
    ip_address: row.ip_address as string | null,
    user_agent: row.user_agent as string | null,
    created_at: new Date(row.created_at as string),
  }
}

export async function create(
  pool: Pool,
  userId: string,
  ttlSeconds: number,
  ipAddress?: string,
  userAgent?: string,
): Promise<Session> {
  const id = nanoid()
  const token = `${nanoid(32)}.${nanoid(16)}`
  const expiresAt = new Date(Date.now() + ttlSeconds * 1000)

  const { rows } = await pool.query(
    `INSERT INTO session (id, user_id, token, expires_at, ip_address, user_agent)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [id, userId, token, expiresAt.toISOString(), ipAddress ?? null, userAgent ?? null],
  )
  return rowToSession(rows[0])
}

export async function findByToken(pool: Pool, token: string): Promise<Session | null> {
  const { rows } = await pool.query(
    'SELECT * FROM session WHERE token = $1 AND expires_at > NOW()',
    [token],
  )
  return rows[0] ? rowToSession(rows[0]) : null
}

export async function revoke(pool: Pool, token: string): Promise<void> {
  await pool.query('DELETE FROM session WHERE token = $1', [token])
}

export async function revokeAll(pool: Pool, userId: string): Promise<void> {
  await pool.query('DELETE FROM session WHERE user_id = $1', [userId])
}

export async function cleanupExpired(pool: Pool): Promise<number> {
  const res = await pool.query('DELETE FROM session WHERE expires_at <= NOW()')
  return res.rowCount ?? 0
}
