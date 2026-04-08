import type { OtpChannel } from './types.js'
import { FutureAuthError } from './errors.js'

export async function sendOtpToServer(
  apiUrl: string,
  secretKey: string,
  channel: OtpChannel,
  destination: string,
  code: string,
  projectName: string,
): Promise<void> {
  const res = await fetch(`${apiUrl}/api/v1/otp/send`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${secretKey}`,
    },
    body: JSON.stringify({ channel, destination, code, project_name: projectName }),
  })

  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw FutureAuthError.otpDeliveryFailed(body.error || `HTTP ${res.status}`)
  }
}

export async function sendMagicLinkToServer(
  apiUrl: string,
  secretKey: string,
  destination: string,
  token: string,
  projectName: string,
): Promise<void> {
  const res = await fetch(`${apiUrl}/api/v1/otp/send`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${secretKey}`,
    },
    body: JSON.stringify({
      channel: 'magic_link',
      destination,
      code: token,
      project_name: projectName,
    }),
  })

  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw FutureAuthError.magicLinkDeliveryFailed(body.error || `HTTP ${res.status}`)
  }
}
