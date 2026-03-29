-- VixAuth's own tables (in VixAuth's database)
-- BetterAuth tables for dashboard developer auth are auto-managed by BetterAuth.

-- Projects table
CREATE TABLE IF NOT EXISTS project (
    id TEXT PRIMARY KEY,
    developer_id TEXT NOT NULL,
    name TEXT NOT NULL,
    publishable_key TEXT NOT NULL UNIQUE,
    secret_key TEXT NOT NULL UNIQUE,
    database_url TEXT NOT NULL,
    twilio_account_sid TEXT,
    twilio_auth_token TEXT,
    twilio_phone_number TEXT,
    allowed_origins JSONB DEFAULT '[]',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_project_developer ON project(developer_id);
CREATE INDEX IF NOT EXISTS idx_project_pub_key ON project(publishable_key);
