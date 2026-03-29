-- FutureAuth server schema (manages developers, projects, and OTP delivery)

CREATE TABLE IF NOT EXISTS developer (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL DEFAULT '',
    email TEXT NOT NULL UNIQUE,
    email_verified BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS developer_session (
    id TEXT PRIMARY KEY,
    developer_id TEXT NOT NULL REFERENCES developer(id) ON DELETE CASCADE,
    token TEXT NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    ip_address TEXT,
    user_agent TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS developer_verification (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL,
    code TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS project (
    id TEXT PRIMARY KEY,
    developer_id TEXT NOT NULL REFERENCES developer(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    publishable_key TEXT NOT NULL UNIQUE,
    secret_key_hash TEXT NOT NULL,
    otp_mode TEXT NOT NULL DEFAULT 'email',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_project_developer ON project(developer_id);
CREATE INDEX IF NOT EXISTS idx_project_pub_key ON project(publishable_key);

CREATE TABLE IF NOT EXISTS developer_api_key (
    id TEXT PRIMARY KEY,
    developer_id TEXT NOT NULL REFERENCES developer(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    key_hash TEXT NOT NULL UNIQUE,
    key_prefix TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_used_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_developer_session_token ON developer_session(token);
CREATE INDEX IF NOT EXISTS idx_developer_verification_email ON developer_verification(email);
