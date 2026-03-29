-- Developer API keys for programmatic access to project management
CREATE TABLE IF NOT EXISTS developer_api_key (
    id TEXT PRIMARY KEY,
    developer_id TEXT NOT NULL,
    name TEXT NOT NULL,
    key_hash TEXT NOT NULL UNIQUE,
    key_prefix TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_used_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_dev_api_key_developer ON developer_api_key(developer_id);
CREATE INDEX IF NOT EXISTS idx_dev_api_key_hash ON developer_api_key(key_hash);
