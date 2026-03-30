use std::env;

#[derive(Debug, Clone)]
pub struct Config {
    pub database_url: String,
    pub port: u16,
    pub cors_origin: String,
    pub hmac_secret: String,
    pub resend_api_key: Option<String>,
    pub resend_from_email: String,
    pub twilio_account_sid: Option<String>,
    pub twilio_auth_token: Option<String>,
    pub twilio_phone_number: Option<String>,
}

impl Config {
    pub fn from_env() -> Self {
        Self {
            database_url: env::var("DATABASE_URL").expect("DATABASE_URL required"),
            port: env::var("PORT")
                .unwrap_or_else(|_| "3002".into())
                .parse()
                .expect("PORT must be a number"),
            cors_origin: env::var("CORS_ORIGIN")
                .unwrap_or_else(|_| "http://localhost:5180".into()),
            hmac_secret: env::var("HMAC_SECRET").expect("HMAC_SECRET required"),
            resend_api_key: env::var("RESEND_API_KEY").ok(),
            resend_from_email: env::var("RESEND_FROM_EMAIL")
                .unwrap_or_else(|_| "noreply@future-auth.com".into()),
            twilio_account_sid: env::var("TWILIO_ACCOUNT_SID").ok(),
            twilio_auth_token: env::var("TWILIO_AUTH_TOKEN").ok(),
            twilio_phone_number: env::var("TWILIO_PHONE_NUMBER").ok(),
        }
    }

    pub fn sms_enabled(&self) -> bool {
        self.twilio_account_sid.is_some()
            && self.twilio_auth_token.is_some()
            && self.twilio_phone_number.is_some()
    }

    pub fn email_enabled(&self) -> bool {
        self.resend_api_key.is_some()
    }
}
