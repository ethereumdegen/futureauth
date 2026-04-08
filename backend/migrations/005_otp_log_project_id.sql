ALTER TABLE otp_log ADD COLUMN IF NOT EXISTS project_id TEXT;
CREATE INDEX IF NOT EXISTS idx_otp_log_project ON otp_log(project_id);
