import { betterAuth } from "better-auth";
import { emailOTP } from "better-auth/plugins";
import pg from "pg";
import { sendOTPEmail } from "./email.js";

const resendApiKey = process.env.RESEND_API_KEY;
const resendFrom = process.env.RESEND_FROM_EMAIL || "noreply@auth.vixautomation.com";

export const dashboardAuth = betterAuth({
  baseURL: process.env.BETTER_AUTH_URL,
  secret: process.env.BETTER_AUTH_SECRET,
  database: new pg.Pool({
    connectionString: process.env.DATABASE_URL,
  }),
  trustedOrigins: [process.env.CORS_ORIGIN || "http://localhost:5180"],
  user: {
    fields: {
      emailVerified: "email_verified",
      createdAt: "created_at",
      updatedAt: "updated_at",
    },
  },
  session: {
    fields: {
      userId: "user_id",
      expiresAt: "expires_at",
      ipAddress: "ip_address",
      userAgent: "user_agent",
      createdAt: "created_at",
      updatedAt: "updated_at",
    },
  },
  account: {
    fields: {
      userId: "user_id",
      accountId: "account_id",
      providerId: "provider_id",
      accessToken: "access_token",
      refreshToken: "refresh_token",
      accessTokenExpiresAt: "access_token_expires_at",
      refreshTokenExpiresAt: "refresh_token_expires_at",
      idToken: "id_token",
      createdAt: "created_at",
      updatedAt: "updated_at",
    },
  },
  verification: {
    fields: {
      expiresAt: "expires_at",
      createdAt: "created_at",
      updatedAt: "updated_at",
    },
  },
  plugins: [
    emailOTP({
      async sendVerificationOTP({ email, otp }) {
        console.log(`[VixAuth] Dashboard OTP ${otp} → ${email}`);
        if (resendApiKey) {
          await sendOTPEmail({
            apiKey: resendApiKey,
            from: resendFrom,
            to: email,
            code: otp,
            projectName: "VixAuth",
          });
        } else {
          console.log("[VixAuth] Resend not configured — OTP logged only");
        }
      },
    }),
  ],
});
