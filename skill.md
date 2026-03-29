# VixAuth Integration — AI Agent Reference

VixAuth is a hosted OTP authentication service. It manages user sign-up, sign-in, and sessions using one-time passwords delivered via SMS (Twilio) or email (Resend). Auth data is stored in the **project owner's own Postgres database**.

## Key Concepts

- **VixAuth URL**: `https://auth.vixautomation.com` (production)
- **Auth proxy pattern**: Your frontend proxies `/api/auth/*` to `https://auth.vixautomation.com/auth/{publishable_key}/api/auth/*`
- **Client SDK**: Uses [BetterAuth](https://better-auth.com) client — `better-auth/react`
- **Auth modes**: `email` (Email OTP via Resend) or `phone` (Phone OTP via Twilio)
- **Session storage**: Sessions live in the project owner's Postgres database, not on VixAuth's servers

## Quick Integration Steps

### 1. Install SDK

```bash
npm install better-auth
```

### 2. Create auth client

**Email OTP:**
```typescript
// src/lib/auth-client.ts
import { createAuthClient } from "better-auth/react";
import { emailOTPClient } from "better-auth/client/plugins";

export const authClient = createAuthClient({
  baseURL: window.location.origin,
  plugins: [emailOTPClient()],
});
export const { useSession, signOut } = authClient;
```

**Phone OTP:**
```typescript
// src/lib/auth-client.ts
import { createAuthClient } from "better-auth/react";
import { phoneNumberClient } from "better-auth/client/plugins";

export const authClient = createAuthClient({
  baseURL: window.location.origin,
  plugins: [phoneNumberClient()],
});
export const { useSession, signOut } = authClient;
```

### 3. Configure proxy (Vite example)

```typescript
// vite.config.ts
export default defineConfig({
  server: {
    proxy: {
      '/api/auth': {
        target: 'https://auth.vixautomation.com',
        changeOrigin: true,
        rewrite: (path) => `/auth/PUBLISHABLE_KEY${path}`,
      },
    },
  },
});
```

**Next.js rewrites:**
```javascript
// next.config.js
module.exports = {
  async rewrites() {
    return [
      {
        source: '/api/auth/:path*',
        destination: 'https://auth.vixautomation.com/auth/PUBLISHABLE_KEY/api/auth/:path*',
      },
    ];
  },
};
```

**Nginx (production):**
```nginx
location /api/auth/ {
    proxy_pass https://auth.vixautomation.com/auth/PUBLISHABLE_KEY/api/auth/;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
}
```

### 4. Sign-in flow

**Email OTP:**
```typescript
// Send code
await authClient.emailOtp.sendVerificationOtp({
  email: "user@example.com",
  type: "sign-in",
});

// Verify code
await authClient.emailOtp.verifyEmail({
  email: "user@example.com",
  otp: "123456",
});
```

**Phone OTP:**
```typescript
// Send code
await authClient.phoneNumber.sendVerificationCode({
  phoneNumber: "+15551234567",
});

// Verify code
await authClient.phoneNumber.verifyPhoneNumber({
  phoneNumber: "+15551234567",
  code: "123456",
});
```

### 5. Check session (React)

```typescript
import { useSession } from "./lib/auth-client";

function Profile() {
  const { data: session, isPending } = useSession();
  if (isPending) return <div>Loading...</div>;
  if (!session) return <div>Not signed in</div>;
  return <div>Hello {session.user.email || session.user.phoneNumber}</div>;
}
```

### 6. Sign out

```typescript
import { signOut } from "./lib/auth-client";
await signOut();
```

### 7. Backend session validation

Query the project's own Postgres database. The session token is in the `better-auth.session_token` cookie.

```sql
SELECT u.* FROM "session" s
JOIN "user" u ON u.id = s."userId"
WHERE s.token = $1
  AND s."expiresAt" > NOW();
```

**Express example:**
```javascript
app.get("/api/me", async (req, res) => {
  const token = req.cookies["better-auth.session_token"];
  if (!token) return res.status(401).json({ error: "Not authenticated" });

  const { rows } = await pool.query(
    `SELECT u.* FROM "session" s
     JOIN "user" u ON u.id = s."userId"
     WHERE s.token = $1 AND s."expiresAt" > NOW()`,
    [token.split(".")[0]]
  );

  if (!rows[0]) return res.status(401).json({ error: "Invalid session" });
  res.json({ user: rows[0] });
});
```

## Database Schema (created automatically by VixAuth)

These tables are created in the **project owner's** database:

| Table | Key columns |
|---|---|
| `user` | id, name, email, phoneNumber, emailVerified, phoneNumberVerified, createdAt |
| `session` | id, userId, token, expiresAt, ipAddress, userAgent, createdAt |
| `account` | id, userId, accountId, providerId |
| `verification` | id, identifier, value, expiresAt |

## VixAuth Management API

Project owners can manage their VixAuth projects programmatically using API keys (created in the dashboard under Settings).

```bash
# Auth header
Authorization: Bearer vxk_YOUR_API_KEY

# Endpoints
GET    /api/projects          # List projects
POST   /api/projects          # Create project
GET    /api/projects/:id      # Get project
PUT    /api/projects/:id      # Update project
DELETE /api/projects/:id      # Delete project
GET    /api/projects/:id/users    # List end-users
GET    /api/projects/:id/sessions # List active sessions

GET    /api/keys              # List API keys
POST   /api/keys              # Create API key
DELETE /api/keys/:id          # Delete API key
```

**Create project payload:**
```json
{
  "name": "My App",
  "database_url": "postgres://user:pass@host/db",
  "auth_mode": "email",
  "allowed_origins": ["https://myapp.com", "http://localhost:5173"]
}
```

## Common Issues

| Problem | Fix |
|---|---|
| "Failed to send code" | Check auth mode matches client plugin. Verify Resend/Twilio creds are configured. |
| CORS errors | Add your frontend origin to project's Allowed Origins in dashboard. |
| Session cookie not set | Verify proxy is correctly rewriting `/api/auth` to VixAuth. |
| "relation does not exist" | Auth tables weren't created — re-create the project or check database connectivity. |
