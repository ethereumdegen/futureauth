use reqwest::Client;

pub async fn send_otp_sms(
    http: &Client,
    account_sid: &str,
    auth_token: &str,
    from: &str,
    to: &str,
    body: &str,
) -> Result<(), String> {
    let url = format!(
        "https://api.twilio.com/2010-04-01/Accounts/{account_sid}/Messages.json"
    );

    let resp = http
        .post(&url)
        .basic_auth(account_sid, Some(auth_token))
        .form(&[("From", from), ("To", to), ("Body", body)])
        .send()
        .await
        .map_err(|e| format!("Twilio request failed: {e}"))?;

    if !resp.status().is_success() {
        let text = resp.text().await.unwrap_or_default();
        return Err(format!("Twilio error: {text}"));
    }

    tracing::info!("SMS OTP sent to {to}");
    Ok(())
}
