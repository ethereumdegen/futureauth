import { betterAuth } from "better-auth";
import { phoneNumber, emailOTP } from "better-auth/plugins";
import pg from "pg";
import { sendSMS } from "./sms.js";
import { sendOTPEmail } from "./email.js";
import { queryOne } from "./db.js";
import { snakeCaseFieldMappings } from "./field-mappings.js";

// Global credentials from env
const twilioAccountSid = process.env.TWILIO_ACCOUNT_SID;
const twilioAuthToken = process.env.TWILIO_AUTH_TOKEN;
const twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER;
const resendApiKey = process.env.RESEND_API_KEY;
const resendFromEmail = process.env.RESEND_FROM_EMAIL || "noreply@auth.vixautomation.com";

// Cache BetterAuth instances per project to avoid re-creating on every request
const authCache = new Map();

export async function getProjectByKey(publishableKey) {
  return queryOne(
    "SELECT * FROM project WHERE publishable_key = $1",
    [publishableKey]
  );
}

function buildPhonePlugin(project) {
  return phoneNumber({
    sendOTP: async ({ phoneNumber: phone, code }) => {
      console.log(`[${project.name}] SMS OTP ${code} → ${phone}`);
      if (twilioAccountSid && twilioAuthToken && twilioPhoneNumber) {
        await sendSMS({
          accountSid: twilioAccountSid,
          authToken: twilioAuthToken,
          from: twilioPhoneNumber,
          to: phone,
          body: `Your ${project.name} code is: ${code}`,
        });
      } else {
        console.log(`[${project.name}] Twilio not configured — OTP logged only`);
      }
    },
    signUpOnVerification: true,
    schema: {
      user: {
        fields: {
          phoneNumber: "phone_number",
          phoneNumberVerified: "phone_number_verified",
        },
      },
    },
  });
}

function buildEmailPlugin(project) {
  return emailOTP({
    async sendVerificationOTP({ email, otp }) {
      console.log(`[${project.name}] Email OTP ${otp} → ${email}`);
      if (resendApiKey) {
        await sendOTPEmail({
          apiKey: resendApiKey,
          from: resendFromEmail,
          to: email,
          code: otp,
          projectName: project.name,
        });
      } else {
        console.log(`[${project.name}] Resend not configured — OTP logged only`);
      }
    },
  });
}

export function getProjectAuth(project) {
  if (authCache.has(project.id)) {
    return authCache.get(project.id);
  }

  const projectPool = new pg.Pool({
    connectionString: project.database_url,
    max: 3,
  });

  const mode = project.auth_mode || "phone";
  const plugin = mode === "email" ? buildEmailPlugin(project) : buildPhonePlugin(project);

  const auth = betterAuth({
    secret: project.secret_key,
    database: projectPool,
    trustedOrigins: project.allowed_origins || [],
    ...snakeCaseFieldMappings,
    plugins: [plugin],
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
        email_verified BOOLEAN DEFAULT false,
        image TEXT,
        phone_number TEXT,
        phone_number_verified BOOLEAN DEFAULT false,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS session (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        token TEXT NOT NULL UNIQUE,
        expires_at TIMESTAMPTZ NOT NULL,
        ip_address TEXT,
        user_agent TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS account (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        account_id TEXT NOT NULL,
        provider_id TEXT NOT NULL,
        access_token TEXT,
        refresh_token TEXT,
        id_token TEXT,
        access_token_expires_at TIMESTAMPTZ,
        refresh_token_expires_at TIMESTAMPTZ,
        scope TEXT,
        password TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS verification (
        id TEXT PRIMARY KEY,
        identifier TEXT NOT NULL,
        value TEXT NOT NULL,
        expires_at TIMESTAMPTZ NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      -- Add phone columns if table already existed
      DO $$ BEGIN
        ALTER TABLE "user" ADD COLUMN IF NOT EXISTS phone_number TEXT;
        ALTER TABLE "user" ADD COLUMN IF NOT EXISTS phone_number_verified BOOLEAN DEFAULT false;
      EXCEPTION WHEN others THEN NULL;
      END $$;
    `);
    console.log("Project database tables ready");
  } finally {
    await client.end();
  }
}
