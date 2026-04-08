export class FutureAuthError extends Error {
  public code: string

  constructor(code: string, message: string) {
    super(message)
    this.name = 'FutureAuthError'
    this.code = code
  }

  static invalidOtp() {
    return new FutureAuthError('INVALID_OTP', 'Invalid OTP code')
  }

  static otpExpired() {
    return new FutureAuthError('OTP_EXPIRED', 'OTP code has expired')
  }

  static otpMaxAttempts() {
    return new FutureAuthError('OTP_MAX_ATTEMPTS', 'Too many failed attempts, code invalidated')
  }

  static otpDeliveryFailed(detail: string) {
    return new FutureAuthError('OTP_DELIVERY_FAILED', `OTP delivery failed: ${detail}`)
  }

  static invalidMagicLink() {
    return new FutureAuthError('INVALID_MAGIC_LINK', 'Invalid magic link token')
  }

  static magicLinkExpired() {
    return new FutureAuthError('MAGIC_LINK_EXPIRED', 'Magic link has expired')
  }

  static magicLinkDeliveryFailed(detail: string) {
    return new FutureAuthError('MAGIC_LINK_DELIVERY_FAILED', `Magic link delivery failed: ${detail}`)
  }

  static sessionNotFound() {
    return new FutureAuthError('SESSION_NOT_FOUND', 'Session not found')
  }

  static userNotFound() {
    return new FutureAuthError('USER_NOT_FOUND', 'User not found')
  }
}
