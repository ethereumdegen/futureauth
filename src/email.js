import { Resend } from "resend";

export async function sendOTPEmail({ apiKey, from, to, code, projectName }) {
  const resend = new Resend(apiKey);
  await resend.emails.send({
    from,
    to,
    subject: `${projectName} — Your sign-in code is ${code}`,
    html: `
      <div style="font-family: sans-serif; max-width: 400px; margin: 0 auto; padding: 24px;">
        <h2 style="margin-bottom: 8px;">${projectName}</h2>
        <p>Your sign-in code:</p>
        <div style="font-size: 32px; font-weight: bold; letter-spacing: 4px; padding: 16px 0;">${code}</div>
        <p style="color: #666; font-size: 14px;">This code expires in 10 minutes. If you didn't request this, ignore this email.</p>
      </div>
    `,
  });
  console.log(`Email OTP sent to ${to}`);
}
