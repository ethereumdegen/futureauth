CREATE TABLE IF NOT EXISTS otp_log (
    id TEXT PRIMARY KEY,
    event TEXT NOT NULL,
    email TEXT NOT NULL,
    ip TEXT,
    success BOOLEAN NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_otp_log_email ON otp_log(email);
CREATE INDEX IF NOT EXISTS idx_otp_log_created ON otp_log(created_at);
