-- Move to global Twilio/Resend credentials — remove per-project fields
ALTER TABLE project DROP COLUMN IF EXISTS twilio_account_sid;
ALTER TABLE project DROP COLUMN IF EXISTS twilio_auth_token;
ALTER TABLE project DROP COLUMN IF EXISTS twilio_phone_number;
ALTER TABLE project DROP COLUMN IF EXISTS resend_api_key;
ALTER TABLE project DROP COLUMN IF EXISTS resend_from_email;
