import type { Pool } from 'pg'

const SCHEMA = `
CREATE TABLE IF NOT EXISTS "user" (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE,
    phone_number TEXT UNIQUE,
    name TEXT NOT NULL DEFAULT '',
    email_verified BOOLEAN NOT NULL DEFAULT FALSE,
    phone_number_verified BOOLEAN NOT NULL DEFAULT FALSE,
    metadata JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS session (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
    token TEXT NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    ip_address TEXT,
    user_agent TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS verification (
    id TEXT PRIMARY KEY,
    identifier TEXT NOT NULL,
    code TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    attempts INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    kind TEXT NOT NULL DEFAULT 'otp'
);

CREATE INDEX IF NOT EXISTS idx_session_token ON session(token);
CREATE INDEX IF NOT EXISTS idx_session_user ON session(user_id);
CREATE INDEX IF NOT EXISTS idx_user_email ON "user"(email);
CREATE INDEX IF NOT EXISTS idx_user_phone ON "user"(phone_number);
CREATE INDEX IF NOT EXISTS idx_verification_identifier ON verification(identifier);
CREATE INDEX IF NOT EXISTS idx_verification_code ON verification(code);
`

export async function ensureTables(pool: Pool): Promise<void> {
  await pool.query(SCHEMA)
}
