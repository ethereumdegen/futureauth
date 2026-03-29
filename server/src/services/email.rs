use reqwest::Client;
use serde_json::json;

pub async fn send_otp_email(
    http: &Client,
    api_key: &str,
    from: &str,
    to: &str,
    code: &str,
    project_name: &str,
) -> Result<(), String> {
    let body = json!({
        "from": from,
        "to": to,
        "subject": format!("{project_name} — Your sign-in code is {code}"),
        "html": format!(
            r#"<div style="font-family: sans-serif; max-width: 400px; margin: 0 auto; padding: 24px;">
                <h2 style="margin-bottom: 8px;">{project_name}</h2>
                <p>Your sign-in code:</p>
                <div style="font-size: 32px; font-weight: bold; letter-spacing: 4px; padding: 16px 0;">{code}</div>
                <p style="color: #666; font-size: 14px;">This code expires in 10 minutes. If you didn't request this, ignore this email.</p>
            </div>"#
        ),
    });

    let resp = http
        .post("https://api.resend.com/emails")
        .bearer_auth(api_key)
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("Resend request failed: {e}"))?;

    if !resp.status().is_success() {
        let text = resp.text().await.unwrap_or_default();
        return Err(format!("Resend error: {text}"));
    }

    tracing::info!("Email OTP sent to {to}");
    Ok(())
}
