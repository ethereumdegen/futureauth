-- Add auth_mode and Resend fields to projects
ALTER TABLE project ADD COLUMN IF NOT EXISTS auth_mode TEXT NOT NULL DEFAULT 'phone';
ALTER TABLE project ADD COLUMN IF NOT EXISTS resend_api_key TEXT;
ALTER TABLE project ADD COLUMN IF NOT EXISTS resend_from_email TEXT;
