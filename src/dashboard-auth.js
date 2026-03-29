import { betterAuth } from "better-auth";
import { emailOTP } from "better-auth/plugins";
import pg from "pg";
import { sendOTPEmail } from "./email.js";

const resendApiKey = process.env.RESEND_API_KEY;
const resendFrom = process.env.RESEND_FROM_EMAIL || "noreply@auth.vixautomation.com";

export const dashboardAuth = betterAuth({
  secret: process.env.BETTER_AUTH_SECRET,
  database: new pg.Pool({
    connectionString: process.env.DATABASE_URL,
  }),
  trustedOrigins: [process.env.CORS_ORIGIN || "http://localhost:5180"],
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
