import { Pool } from 'pg';

interface FutureAuthConfig {
    /** FutureAuth server URL (default: "https://future-auth.com") */
    apiUrl: string;
    /** Project secret key (vx_sec_...) */
    secretKey: string;
    /** Project name for branding in emails/SMS */
    projectName: string;
    /** Session TTL in seconds (default: 30 days) */
    sessionTtlSeconds: number;
    /** OTP TTL in seconds (default: 2 minutes) */
    otpTtlSeconds: number;
    /** OTP code length (default: 6) */
    otpLength: number;
    /** Session cookie name (default: "futureauth_session") */
    cookieName: string;
    /** Magic link TTL in seconds (default: 15 minutes) */
    magicLinkTtlSeconds: number;
}
declare const defaultConfig: FutureAuthConfig;

interface User {
    id: string;
    email: string | null;
    phone_number: string | null;
    name: string;
    email_verified: boolean;
    phone_number_verified: boolean;
    metadata: Record<string, unknown>;
    created_at: Date;
    updated_at: Date;
}
interface Session {
    id: string;
    user_id: string;
    token: string;
    expires_at: Date;
    ip_address: string | null;
    user_agent: string | null;
    created_at: Date;
}
interface Verification {
    id: string;
    identifier: string;
    code: string;
    expires_at: Date;
    attempts: number;
    created_at: Date;
    kind: string;
}
type OtpChannel = 'email' | 'sms';

declare class FutureAuth {
    readonly pool: Pool;
    readonly config: FutureAuthConfig;
    constructor(pool: Pool, config: Partial<FutureAuthConfig> & Pick<FutureAuthConfig, 'secretKey'>);
    /** Create auth tables if they don't exist. Safe to call on every startup. */
    ensureTables(): Promise<void>;
    /** Send OTP code via email or SMS. */
    sendOtp(channel: OtpChannel, destination: string): Promise<void>;
    /** Verify OTP code. Returns user and session on success. */
    verifyOtp(identifier: string, code: string, ip?: string, ua?: string): Promise<{
        user: User;
        session: Session;
    }>;
    /** Validate a session token. Returns user and session if valid, null otherwise. */
    getSession(token: string): Promise<{
        user: User;
        session: Session;
    } | null>;
    /** Revoke a single session. */
    revokeSession(token: string): Promise<void>;
    /** Revoke all sessions for a user. */
    revokeAllSessions(userId: string): Promise<void>;
    /** Send a magic link via email. */
    sendMagicLink(destination: string): Promise<void>;
    /** Verify a magic link token. Returns user and session on success. */
    verifyMagicLink(token: string, ip?: string, ua?: string): Promise<{
        user: User;
        session: Session;
    }>;
    /** Remove expired sessions and verification codes. */
    cleanupExpired(): Promise<{
        sessions: number;
        verifications: number;
    }>;
    /** Look up a user by ID. */
    getUser(id: string): Promise<User | null>;
    /** Look up a user by email. */
    getUserByEmail(email: string): Promise<User | null>;
    /** Update a user's display name. */
    updateUserName(userId: string, name: string): Promise<User>;
    /** Replace user metadata entirely. */
    setUserMetadata(userId: string, metadata: Record<string, unknown>): Promise<User>;
    /** Shallow-merge a patch into user metadata. */
    mergeUserMetadata(userId: string, patch: Record<string, unknown>): Promise<User>;
}

declare class FutureAuthError extends Error {
    code: string;
    constructor(code: string, message: string);
    static invalidOtp(): FutureAuthError;
    static otpExpired(): FutureAuthError;
    static otpMaxAttempts(): FutureAuthError;
    static otpDeliveryFailed(detail: string): FutureAuthError;
    static invalidMagicLink(): FutureAuthError;
    static magicLinkExpired(): FutureAuthError;
    static magicLinkDeliveryFailed(detail: string): FutureAuthError;
    static sessionNotFound(): FutureAuthError;
    static userNotFound(): FutureAuthError;
}

export { FutureAuth, type FutureAuthConfig, FutureAuthError, type OtpChannel, type Session, type User, type Verification, defaultConfig };
