// src/config.ts
var defaultConfig = {
  apiUrl: "https://future-auth.com",
  secretKey: "",
  projectName: "",
  sessionTtlSeconds: 30 * 24 * 60 * 60,
  // 30 days
  otpTtlSeconds: 2 * 60,
  // 2 minutes
  otpLength: 6,
  cookieName: "futureauth_session",
  magicLinkTtlSeconds: 15 * 60
  // 15 minutes
};

// src/db/migrations.ts
var SCHEMA = `
CREATE TABLE IF NOT EXISTS "user" (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE,
    phone_number TEXT UNIQUE,
    name TEXT NOT NULL DEFAULT '',
    email_verified BOOLEAN NOT NULL DEFAULT FALSE,
    phone_number_verified BOOLEAN NOT NULL DEFAULT FALSE,
    metadata JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS session (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
    token TEXT NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    ip_address TEXT,
    user_agent TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS verification (
    id TEXT PRIMARY KEY,
    identifier TEXT NOT NULL,
    code TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    attempts INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    kind TEXT NOT NULL DEFAULT 'otp'
);

CREATE INDEX IF NOT EXISTS idx_session_token ON session(token);
CREATE INDEX IF NOT EXISTS idx_session_user ON session(user_id);
CREATE INDEX IF NOT EXISTS idx_user_email ON "user"(email);
CREATE INDEX IF NOT EXISTS idx_user_phone ON "user"(phone_number);
CREATE INDEX IF NOT EXISTS idx_verification_identifier ON verification(identifier);
CREATE INDEX IF NOT EXISTS idx_verification_code ON verification(code);
`;
async function ensureTables(pool) {
  await pool.query(SCHEMA);
}

// src/db/user.ts
import { nanoid } from "nanoid";
function rowToUser(row) {
  return {
    id: row.id,
    email: row.email,
    phone_number: row.phone_number,
    name: row.name,
    email_verified: row.email_verified,
    phone_number_verified: row.phone_number_verified,
    metadata: row.metadata ?? {},
    created_at: new Date(row.created_at),
    updated_at: new Date(row.updated_at)
  };
}
async function findById(pool, id) {
  const { rows } = await pool.query('SELECT * FROM "user" WHERE id = $1', [id]);
  return rows[0] ? rowToUser(rows[0]) : null;
}
async function findByEmail(pool, email) {
  const { rows } = await pool.query('SELECT * FROM "user" WHERE email = $1', [email]);
  return rows[0] ? rowToUser(rows[0]) : null;
}
async function findByPhone(pool, phone) {
  const { rows } = await pool.query('SELECT * FROM "user" WHERE phone_number = $1', [phone]);
  return rows[0] ? rowToUser(rows[0]) : null;
}
async function findOrCreateByEmail(pool, email) {
  const existing = await findByEmail(pool, email);
  if (existing) return existing;
  const id = nanoid();
  const { rows } = await pool.query(
    `INSERT INTO "user" (id, email, email_verified) VALUES ($1, $2, TRUE)
     ON CONFLICT (email) DO UPDATE SET email_verified = TRUE
     RETURNING *`,
    [id, email]
  );
  return rowToUser(rows[0]);
}
async function findOrCreateByPhone(pool, phone) {
  const existing = await findByPhone(pool, phone);
  if (existing) return existing;
  const id = nanoid();
  const { rows } = await pool.query(
    `INSERT INTO "user" (id, phone_number, phone_number_verified) VALUES ($1, $2, TRUE)
     ON CONFLICT (phone_number) DO UPDATE SET phone_number_verified = TRUE
     RETURNING *`,
    [id, phone]
  );
  return rowToUser(rows[0]);
}
async function updateName(pool, userId, name) {
  const { rows } = await pool.query(
    `UPDATE "user" SET name = $2, updated_at = NOW() WHERE id = $1 RETURNING *`,
    [userId, name]
  );
  if (!rows[0]) throw new Error("User not found");
  return rowToUser(rows[0]);
}
async function setMetadata(pool, userId, metadata) {
  const { rows } = await pool.query(
    `UPDATE "user" SET metadata = $2::jsonb, updated_at = NOW() WHERE id = $1 RETURNING *`,
    [userId, JSON.stringify(metadata)]
  );
  if (!rows[0]) throw new Error("User not found");
  return rowToUser(rows[0]);
}
async function mergeMetadata(pool, userId, patch) {
  const { rows } = await pool.query(
    `UPDATE "user" SET metadata = metadata || $2::jsonb, updated_at = NOW() WHERE id = $1 RETURNING *`,
    [userId, JSON.stringify(patch)]
  );
  if (!rows[0]) throw new Error("User not found");
  return rowToUser(rows[0]);
}

// src/db/session.ts
import { nanoid as nanoid2 } from "nanoid";
function rowToSession(row) {
  return {
    id: row.id,
    user_id: row.user_id,
    token: row.token,
    expires_at: new Date(row.expires_at),
    ip_address: row.ip_address,
    user_agent: row.user_agent,
    created_at: new Date(row.created_at)
  };
}
async function create(pool, userId, ttlSeconds, ipAddress, userAgent) {
  const id = nanoid2();
  const token = `${nanoid2(32)}.${nanoid2(16)}`;
  const expiresAt = new Date(Date.now() + ttlSeconds * 1e3);
  const { rows } = await pool.query(
    `INSERT INTO session (id, user_id, token, expires_at, ip_address, user_agent)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [id, userId, token, expiresAt.toISOString(), ipAddress ?? null, userAgent ?? null]
  );
  return rowToSession(rows[0]);
}
async function findByToken(pool, token) {
  const { rows } = await pool.query(
    "SELECT * FROM session WHERE token = $1 AND expires_at > NOW()",
    [token]
  );
  return rows[0] ? rowToSession(rows[0]) : null;
}
async function revoke(pool, token) {
  await pool.query("DELETE FROM session WHERE token = $1", [token]);
}
async function revokeAll(pool, userId) {
  await pool.query("DELETE FROM session WHERE user_id = $1", [userId]);
}
async function cleanupExpired(pool) {
  const res = await pool.query("DELETE FROM session WHERE expires_at <= NOW()");
  return res.rowCount ?? 0;
}

// src/db/verification.ts
import { nanoid as nanoid3 } from "nanoid";

// src/errors.ts
var FutureAuthError = class _FutureAuthError extends Error {
  code;
  constructor(code, message) {
    super(message);
    this.name = "FutureAuthError";
    this.code = code;
  }
  static invalidOtp() {
    return new _FutureAuthError("INVALID_OTP", "Invalid OTP code");
  }
  static otpExpired() {
    return new _FutureAuthError("OTP_EXPIRED", "OTP code has expired");
  }
  static otpMaxAttempts() {
    return new _FutureAuthError("OTP_MAX_ATTEMPTS", "Too many failed attempts, code invalidated");
  }
  static otpDeliveryFailed(detail) {
    return new _FutureAuthError("OTP_DELIVERY_FAILED", `OTP delivery failed: ${detail}`);
  }
  static invalidMagicLink() {
    return new _FutureAuthError("INVALID_MAGIC_LINK", "Invalid magic link token");
  }
  static magicLinkExpired() {
    return new _FutureAuthError("MAGIC_LINK_EXPIRED", "Magic link has expired");
  }
  static magicLinkDeliveryFailed(detail) {
    return new _FutureAuthError("MAGIC_LINK_DELIVERY_FAILED", `Magic link delivery failed: ${detail}`);
  }
  static sessionNotFound() {
    return new _FutureAuthError("SESSION_NOT_FOUND", "Session not found");
  }
  static userNotFound() {
    return new _FutureAuthError("USER_NOT_FOUND", "User not found");
  }
};

// src/db/verification.ts
var MAX_ATTEMPTS = 4;
function rowToVerification(row) {
  return {
    id: row.id,
    identifier: row.identifier,
    code: row.code,
    expires_at: new Date(row.expires_at),
    attempts: row.attempts,
    created_at: new Date(row.created_at),
    kind: row.kind
  };
}
async function create2(pool, identifier, code, ttlSeconds) {
  await pool.query(
    "DELETE FROM verification WHERE identifier = $1 AND kind = 'otp'",
    [identifier]
  );
  const id = nanoid3();
  const expiresAt = new Date(Date.now() + ttlSeconds * 1e3);
  const { rows } = await pool.query(
    `INSERT INTO verification (id, identifier, code, expires_at, kind)
     VALUES ($1, $2, $3, $4, 'otp') RETURNING *`,
    [id, identifier, code, expiresAt.toISOString()]
  );
  return rowToVerification(rows[0]);
}
async function verify(pool, identifier, code) {
  const { rows } = await pool.query(
    "SELECT * FROM verification WHERE identifier = $1 AND kind = 'otp'",
    [identifier]
  );
  if (!rows[0]) {
    throw FutureAuthError.invalidOtp();
  }
  const record = rowToVerification(rows[0]);
  if (record.expires_at <= /* @__PURE__ */ new Date()) {
    await pool.query("DELETE FROM verification WHERE id = $1", [record.id]);
    throw FutureAuthError.otpExpired();
  }
  if (record.code !== code) {
    const newAttempts = record.attempts + 1;
    if (newAttempts >= MAX_ATTEMPTS) {
      await pool.query("DELETE FROM verification WHERE id = $1", [record.id]);
      throw FutureAuthError.otpMaxAttempts();
    }
    await pool.query(
      "UPDATE verification SET attempts = $2 WHERE id = $1",
      [record.id, newAttempts]
    );
    throw FutureAuthError.invalidOtp();
  }
  await pool.query("DELETE FROM verification WHERE id = $1", [record.id]);
}
async function createMagicLink(pool, identifier, token, ttlSeconds) {
  await pool.query(
    "DELETE FROM verification WHERE identifier = $1 AND kind = 'magic_link'",
    [identifier]
  );
  const id = nanoid3();
  const expiresAt = new Date(Date.now() + ttlSeconds * 1e3);
  const { rows } = await pool.query(
    `INSERT INTO verification (id, identifier, code, expires_at, kind)
     VALUES ($1, $2, $3, $4, 'magic_link') RETURNING *`,
    [id, identifier, token, expiresAt.toISOString()]
  );
  return rowToVerification(rows[0]);
}
async function verifyMagicLink(pool, token) {
  const { rows } = await pool.query(
    "SELECT * FROM verification WHERE code = $1 AND kind = 'magic_link'",
    [token]
  );
  if (!rows[0]) {
    throw FutureAuthError.invalidMagicLink();
  }
  const record = rowToVerification(rows[0]);
  if (record.expires_at <= /* @__PURE__ */ new Date()) {
    await pool.query("DELETE FROM verification WHERE id = $1", [record.id]);
    throw FutureAuthError.magicLinkExpired();
  }
  await pool.query("DELETE FROM verification WHERE id = $1", [record.id]);
  return record.identifier;
}
async function cleanupExpired2(pool) {
  const res = await pool.query("DELETE FROM verification WHERE expires_at <= NOW()");
  return res.rowCount ?? 0;
}

// src/client.ts
async function sendOtpToServer(apiUrl, secretKey, channel, destination, code, projectName) {
  const res = await fetch(`${apiUrl}/api/v1/otp/send`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${secretKey}`
    },
    body: JSON.stringify({ channel, destination, code, project_name: projectName })
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw FutureAuthError.otpDeliveryFailed(body.error || `HTTP ${res.status}`);
  }
}
async function sendMagicLinkToServer(apiUrl, secretKey, destination, token, projectName) {
  const res = await fetch(`${apiUrl}/api/v1/otp/send`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${secretKey}`
    },
    body: JSON.stringify({
      channel: "magic_link",
      destination,
      code: token,
      project_name: projectName
    })
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw FutureAuthError.magicLinkDeliveryFailed(body.error || `HTTP ${res.status}`);
  }
}

// src/futureauth.ts
var OTP_CHARSET = "abcdefghijklmnopqrstuvwxyz0123456789";
function generateOtp(length) {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => OTP_CHARSET[b % OTP_CHARSET.length]).join("");
}
var FutureAuth = class {
  pool;
  config;
  constructor(pool, config) {
    this.pool = pool;
    this.config = { ...defaultConfig, ...config };
  }
  /** Create auth tables if they don't exist. Safe to call on every startup. */
  async ensureTables() {
    await ensureTables(this.pool);
  }
  /** Send OTP code via email or SMS. */
  async sendOtp(channel, destination) {
    const code = generateOtp(this.config.otpLength);
    await create2(this.pool, destination, code, this.config.otpTtlSeconds);
    await sendOtpToServer(
      this.config.apiUrl,
      this.config.secretKey,
      channel,
      destination,
      code,
      this.config.projectName
    );
  }
  /** Verify OTP code. Returns user and session on success. */
  async verifyOtp(identifier, code, ip, ua) {
    await verify(this.pool, identifier, code);
    const user = identifier.includes("@") ? await findOrCreateByEmail(this.pool, identifier) : await findOrCreateByPhone(this.pool, identifier);
    const session = await create(
      this.pool,
      user.id,
      this.config.sessionTtlSeconds,
      ip,
      ua
    );
    return { user, session };
  }
  /** Validate a session token. Returns user and session if valid, null otherwise. */
  async getSession(token) {
    const session = await findByToken(this.pool, token);
    if (!session) return null;
    const user = await findById(this.pool, session.user_id);
    if (!user) return null;
    return { user, session };
  }
  /** Revoke a single session. */
  async revokeSession(token) {
    await revoke(this.pool, token);
  }
  /** Revoke all sessions for a user. */
  async revokeAllSessions(userId) {
    await revokeAll(this.pool, userId);
  }
  /** Send a magic link via email. */
  async sendMagicLink(destination) {
    const { nanoid: nanoid4 } = await import("nanoid");
    const token = nanoid4(48);
    await createMagicLink(
      this.pool,
      destination,
      token,
      this.config.magicLinkTtlSeconds
    );
    await sendMagicLinkToServer(
      this.config.apiUrl,
      this.config.secretKey,
      destination,
      token,
      this.config.projectName
    );
  }
  /** Verify a magic link token. Returns user and session on success. */
  async verifyMagicLink(token, ip, ua) {
    const identifier = await verifyMagicLink(this.pool, token);
    const user = identifier.includes("@") ? await findOrCreateByEmail(this.pool, identifier) : await findOrCreateByPhone(this.pool, identifier);
    const session = await create(
      this.pool,
      user.id,
      this.config.sessionTtlSeconds,
      ip,
      ua
    );
    return { user, session };
  }
  /** Remove expired sessions and verification codes. */
  async cleanupExpired() {
    const [sessions, verifications] = await Promise.all([
      cleanupExpired(this.pool),
      cleanupExpired2(this.pool)
    ]);
    return { sessions, verifications };
  }
  /** Look up a user by ID. */
  async getUser(id) {
    return findById(this.pool, id);
  }
  /** Look up a user by email. */
  async getUserByEmail(email) {
    return findByEmail(this.pool, email);
  }
  /** Update a user's display name. */
  async updateUserName(userId, name) {
    return updateName(this.pool, userId, name);
  }
  /** Replace user metadata entirely. */
  async setUserMetadata(userId, metadata) {
    return setMetadata(this.pool, userId, metadata);
  }
  /** Shallow-merge a patch into user metadata. */
  async mergeUserMetadata(userId, patch) {
    return mergeMetadata(this.pool, userId, patch);
  }
};
export {
  FutureAuth,
  FutureAuthError,
  defaultConfig
};
