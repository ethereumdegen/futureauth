import type { Pool } from 'pg'
import { nanoid } from 'nanoid'
import type { User } from '../types.js'

function rowToUser(row: Record<string, unknown>): User {
  return {
    id: row.id as string,
    email: row.email as string | null,
    phone_number: row.phone_number as string | null,
    name: row.name as string,
    email_verified: row.email_verified as boolean,
    phone_number_verified: row.phone_number_verified as boolean,
    metadata: (row.metadata ?? {}) as Record<string, unknown>,
    created_at: new Date(row.created_at as string),
    updated_at: new Date(row.updated_at as string),
  }
}

export async function findById(pool: Pool, id: string): Promise<User | null> {
  const { rows } = await pool.query('SELECT * FROM "user" WHERE id = $1', [id])
  return rows[0] ? rowToUser(rows[0]) : null
}

export async function findByEmail(pool: Pool, email: string): Promise<User | null> {
  const { rows } = await pool.query('SELECT * FROM "user" WHERE email = $1', [email])
  return rows[0] ? rowToUser(rows[0]) : null
}

export async function findByPhone(pool: Pool, phone: string): Promise<User | null> {
  const { rows } = await pool.query('SELECT * FROM "user" WHERE phone_number = $1', [phone])
  return rows[0] ? rowToUser(rows[0]) : null
}

export async function findOrCreateByEmail(pool: Pool, email: string): Promise<User> {
  const existing = await findByEmail(pool, email)
  if (existing) return existing

  const id = nanoid()
  const { rows } = await pool.query(
    `INSERT INTO "user" (id, email, email_verified) VALUES ($1, $2, TRUE)
     ON CONFLICT (email) DO UPDATE SET email_verified = TRUE
     RETURNING *`,
    [id, email],
  )
  return rowToUser(rows[0])
}

export async function findOrCreateByPhone(pool: Pool, phone: string): Promise<User> {
  const existing = await findByPhone(pool, phone)
  if (existing) return existing

  const id = nanoid()
  const { rows } = await pool.query(
    `INSERT INTO "user" (id, phone_number, phone_number_verified) VALUES ($1, $2, TRUE)
     ON CONFLICT (phone_number) DO UPDATE SET phone_number_verified = TRUE
     RETURNING *`,
    [id, phone],
  )
  return rowToUser(rows[0])
}

export async function updateName(pool: Pool, userId: string, name: string): Promise<User> {
  const { rows } = await pool.query(
    `UPDATE "user" SET name = $2, updated_at = NOW() WHERE id = $1 RETURNING *`,
    [userId, name],
  )
  if (!rows[0]) throw new Error('User not found')
  return rowToUser(rows[0])
}

export async function setMetadata(pool: Pool, userId: string, metadata: Record<string, unknown>): Promise<User> {
  const { rows } = await pool.query(
    `UPDATE "user" SET metadata = $2::jsonb, updated_at = NOW() WHERE id = $1 RETURNING *`,
    [userId, JSON.stringify(metadata)],
  )
  if (!rows[0]) throw new Error('User not found')
  return rowToUser(rows[0])
}

export async function mergeMetadata(pool: Pool, userId: string, patch: Record<string, unknown>): Promise<User> {
  const { rows } = await pool.query(
    `UPDATE "user" SET metadata = metadata || $2::jsonb, updated_at = NOW() WHERE id = $1 RETURNING *`,
    [userId, JSON.stringify(patch)],
  )
  if (!rows[0]) throw new Error('User not found')
  return rowToUser(rows[0])
}
