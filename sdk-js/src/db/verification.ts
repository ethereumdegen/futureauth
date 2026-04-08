import type { Pool } from 'pg'
import { nanoid } from 'nanoid'
import type { Verification } from '../types.js'
import { FutureAuthError } from '../errors.js'

const MAX_ATTEMPTS = 4

function rowToVerification(row: Record<string, unknown>): Verification {
  return {
    id: row.id as string,
    identifier: row.identifier as string,
    code: row.code as string,
    expires_at: new Date(row.expires_at as string),
    attempts: row.attempts as number,
    created_at: new Date(row.created_at as string),
    kind: row.kind as string,
  }
}

export async function create(
  pool: Pool,
  identifier: string,
  code: string,
  ttlSeconds: number,
): Promise<Verification> {
  // Delete any existing OTP for this identifier
  await pool.query(
    "DELETE FROM verification WHERE identifier = $1 AND kind = 'otp'",
    [identifier],
  )

  const id = nanoid()
  const expiresAt = new Date(Date.now() + ttlSeconds * 1000)

  const { rows } = await pool.query(
    `INSERT INTO verification (id, identifier, code, expires_at, kind)
     VALUES ($1, $2, $3, $4, 'otp') RETURNING *`,
    [id, identifier, code, expiresAt.toISOString()],
  )
  return rowToVerification(rows[0])
}

export async function verify(
  pool: Pool,
  identifier: string,
  code: string,
): Promise<void> {
  const { rows } = await pool.query(
    "SELECT * FROM verification WHERE identifier = $1 AND kind = 'otp'",
    [identifier],
  )

  if (!rows[0]) {
    throw FutureAuthError.invalidOtp()
  }

  const record = rowToVerification(rows[0])

  if (record.expires_at <= new Date()) {
    await pool.query('DELETE FROM verification WHERE id = $1', [record.id])
    throw FutureAuthError.otpExpired()
  }

  if (record.code !== code) {
    const newAttempts = record.attempts + 1
    if (newAttempts >= MAX_ATTEMPTS) {
      await pool.query('DELETE FROM verification WHERE id = $1', [record.id])
      throw FutureAuthError.otpMaxAttempts()
    }
    await pool.query(
      'UPDATE verification SET attempts = $2 WHERE id = $1',
      [record.id, newAttempts],
    )
    throw FutureAuthError.invalidOtp()
  }

  // Success — delete used code
  await pool.query('DELETE FROM verification WHERE id = $1', [record.id])
}

export async function createMagicLink(
  pool: Pool,
  identifier: string,
  token: string,
  ttlSeconds: number,
): Promise<Verification> {
  // Delete any existing magic link for this identifier
  await pool.query(
    "DELETE FROM verification WHERE identifier = $1 AND kind = 'magic_link'",
    [identifier],
  )

  const id = nanoid()
  const expiresAt = new Date(Date.now() + ttlSeconds * 1000)

  const { rows } = await pool.query(
    `INSERT INTO verification (id, identifier, code, expires_at, kind)
     VALUES ($1, $2, $3, $4, 'magic_link') RETURNING *`,
    [id, identifier, token, expiresAt.toISOString()],
  )
  return rowToVerification(rows[0])
}

export async function verifyMagicLink(pool: Pool, token: string): Promise<string> {
  const { rows } = await pool.query(
    "SELECT * FROM verification WHERE code = $1 AND kind = 'magic_link'",
    [token],
  )

  if (!rows[0]) {
    throw FutureAuthError.invalidMagicLink()
  }

  const record = rowToVerification(rows[0])

  if (record.expires_at <= new Date()) {
    await pool.query('DELETE FROM verification WHERE id = $1', [record.id])
    throw FutureAuthError.magicLinkExpired()
  }

  // Success — delete used token, return identifier
  await pool.query('DELETE FROM verification WHERE id = $1', [record.id])
  return record.identifier
}

export async function cleanupExpired(pool: Pool): Promise<number> {
  const res = await pool.query('DELETE FROM verification WHERE expires_at <= NOW()')
  return res.rowCount ?? 0
}
