use reqwest::Client;
use serde_json::json;

fn html_escape(s: &str) -> String {
    s.replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
        .replace('\'', "&#x27;")
}

pub async fn send_otp_email(
    http: &Client,
    api_key: &str,
    from: &str,
    to: &str,
    code: &str,
    project_name: &str,
) -> Result<(), String> {
    let safe_name = html_escape(project_name);
    let safe_code = html_escape(code);

    let body = json!({
        "from": from,
        "to": to,
        "subject": format!("{project_name} — Your sign-in code is {code}"),
        "html": format!(
            r#"<div style="font-family: sans-serif; max-width: 400px; margin: 0 auto; padding: 24px;">
                <h2 style="margin-bottom: 8px;">{safe_name}</h2>
                <p>Your sign-in code:</p>
                <div style="font-size: 32px; font-weight: bold; letter-spacing: 4px; padding: 16px 0;">{safe_code}</div>
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
