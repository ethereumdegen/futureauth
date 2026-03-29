import { betterAuth } from "better-auth";
import pg from "pg";

export const dashboardAuth = betterAuth({
  secret: process.env.BETTER_AUTH_SECRET,
  database: new pg.Pool({
    connectionString: process.env.DATABASE_URL,
  }),
  trustedOrigins: [process.env.CORS_ORIGIN || "http://localhost:5180"],
  emailAndPassword: {
    enabled: true,
  },
});
