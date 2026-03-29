import { betterAuth } from "better-auth";
import { phoneNumber } from "better-auth/plugins";
import pg from "pg";
import { sendSMS } from "./sms.js";
import { queryOne } from "./db.js";

// Cache BetterAuth instances per project to avoid re-creating on every request
const authCache = new Map();

export async function getProjectByKey(publishableKey) {
  return queryOne(
    "SELECT * FROM project WHERE publishable_key = $1",
    [publishableKey]
  );
}

export function getProjectAuth(project) {
  if (authCache.has(project.id)) {
    return authCache.get(project.id);
  }

  const projectPool = new pg.Pool({
    connectionString: project.database_url,
    max: 3,
  });

  const auth = betterAuth({
    secret: project.secret_key,
    database: projectPool,
    trustedOrigins: project.allowed_origins || [],
    plugins: [
      phoneNumber({
        sendOTP: async ({ phoneNumber: phone, code }) => {
          console.log(`[${project.name}] OTP ${code} → ${phone}`);
          if (project.twilio_account_sid && project.twilio_auth_token && project.twilio_phone_number) {
            await sendSMS({
              accountSid: project.twilio_account_sid,
              authToken: project.twilio_auth_token,
              from: project.twilio_phone_number,
              to: phone,
              body: `Your ${project.name} code is: ${code}`,
            });
          } else {
            console.log(`[${project.name}] Twilio not configured — OTP logged only`);
          }
        },
        signUpOnVerification: true,
      }),
    ],
  });

  authCache.set(project.id, auth);
  return auth;
}

// Clear cache when project is updated
export function invalidateProjectCache(projectId) {
  authCache.delete(projectId);
}

// Setup BetterAuth tables in the project's database
export async function setupProjectDatabase(databaseUrl) {
  const client = new pg.Client({ connectionString: databaseUrl });
  await client.connect();

  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS "user" (
        id TEXT PRIMARY KEY,
        name TEXT,
        email TEXT UNIQUE,
        "emailVerified" BOOLEAN DEFAULT false,
        image TEXT,
        "phoneNumber" TEXT,
        "phoneNumberVerified" BOOLEAN DEFAULT false,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS "session" (
        id TEXT PRIMARY KEY,
        "expiresAt" TIMESTAMPTZ NOT NULL,
        token TEXT NOT NULL UNIQUE,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "ipAddress" TEXT,
        "userAgent" TEXT,
        "userId" TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS "account" (
        id TEXT PRIMARY KEY,
        "accountId" TEXT NOT NULL,
        "providerId" TEXT NOT NULL,
        "userId" TEXT NOT NULL,
        "accessToken" TEXT,
        "refreshToken" TEXT,
        "idToken" TEXT,
        "accessTokenExpiresAt" TIMESTAMPTZ,
        "refreshTokenExpiresAt" TIMESTAMPTZ,
        scope TEXT,
        password TEXT,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS "verification" (
        id TEXT PRIMARY KEY,
        identifier TEXT NOT NULL,
        value TEXT NOT NULL,
        "expiresAt" TIMESTAMPTZ NOT NULL,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      -- Add phone columns if table already existed
      DO $$ BEGIN
        ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "phoneNumber" TEXT;
        ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "phoneNumberVerified" BOOLEAN DEFAULT false;
      EXCEPTION WHEN others THEN NULL;
      END $$;
    `);
    console.log("Project database tables ready");
  } finally {
    await client.end();
  }
}
