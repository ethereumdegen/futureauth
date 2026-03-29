import { Link } from 'react-router'
import { ArrowLeft, Phone, Copy, Check } from 'lucide-react'
import { useState } from 'react'

export default function Docs() {
  const [copied, setCopied] = useState('')
  const vixauthUrl = window.location.origin

  function copy(text: string, label: string) {
    navigator.clipboard.writeText(text)
    setCopied(label)
    setTimeout(() => setCopied(''), 2000)
  }

  return (
    <div className="min-h-screen bg-white">
      <nav className="border-b border-gray-200 sticky top-0 bg-white/80 backdrop-blur-xl z-10">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center gap-3">
          <Link to="/" className="text-gray-400 hover:text-gray-900 transition-colors">
            <ArrowLeft size={16} />
          </Link>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-emerald-600 rounded-lg flex items-center justify-center">
              <Phone size={14} className="text-white" />
            </div>
            <span className="text-lg font-bold text-gray-900">VixAuth</span>
          </div>
          <span className="text-gray-300">/</span>
          <span className="text-sm text-gray-500 font-medium">Integration Guide</span>
        </div>
      </nav>

      <div className="max-w-3xl mx-auto px-6 py-10">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Integration Guide</h1>
        <p className="text-gray-500 mb-10">Add passwordless OTP authentication to your app in minutes.</p>

        {/* Overview */}
        <Section id="overview" title="How it works">
          <p>
            VixAuth provides <strong>hosted OTP authentication</strong> for your app. You create a project in the dashboard,
            configure a proxy in your frontend, and use the BetterAuth client SDK to send and verify codes.
            VixAuth handles OTP delivery (via SMS or email), user creation, and session management — all stored in <strong>your own Postgres database</strong>.
          </p>
          <ol className="list-decimal list-inside space-y-1 mt-3 text-gray-600">
            <li>Create a project in the VixAuth dashboard</li>
            <li>Provide your Postgres database URL (e.g. Neon, Supabase, Railway)</li>
            <li>Choose an auth mode: <strong>Phone OTP</strong> (SMS) or <strong>Email OTP</strong></li>
            <li>Add a proxy rule in your frontend to route auth requests to VixAuth</li>
            <li>Use the BetterAuth client SDK to trigger sign-in flows</li>
            <li>Query your own database for session validation on the backend</li>
          </ol>
        </Section>

        {/* Prerequisites */}
        <Section id="prerequisites" title="Prerequisites">
          <ul className="list-disc list-inside space-y-1 text-gray-600">
            <li>A Postgres database (Neon, Supabase, Railway Postgres, etc.)</li>
            <li>A React + Vite frontend (or any JS framework with proxy support)</li>
            <li>An account on VixAuth — <a href="/sign-up" className="text-emerald-600 underline">sign up here</a></li>
          </ul>
        </Section>

        {/* Step 1 */}
        <Section id="create-project" title="1. Create a project">
          <p>
            Go to the <Link to="/" className="text-emerald-600 underline">dashboard</Link> and click <strong>New Project</strong>.
            Provide a name, your database URL, and select an auth mode.
          </p>
          <p className="mt-2">
            VixAuth will auto-create the necessary auth tables (<code className="bg-gray-100 px-1.5 py-0.5 rounded text-sm">user</code>,
            <code className="bg-gray-100 px-1.5 py-0.5 rounded text-sm">session</code>,
            <code className="bg-gray-100 px-1.5 py-0.5 rounded text-sm">account</code>,
            <code className="bg-gray-100 px-1.5 py-0.5 rounded text-sm">verification</code>)
            in your database. You'll receive a <strong>publishable key</strong> and <strong>secret key</strong>.
          </p>
          <Callout>
            Keep your secret key safe. The publishable key is safe to expose in frontend code.
          </Callout>
        </Section>

        {/* Step 2 */}
        <Section id="install-sdk" title="2. Install the BetterAuth client SDK">
          <CodeBlock
            label="npm"
            code="npm install better-auth"
            copied={copied}
            onCopy={copy}
          />
        </Section>

        {/* Step 3 */}
        <Section id="auth-client" title="3. Create the auth client">
          <p className="mb-3">
            Create a file like <code className="bg-gray-100 px-1.5 py-0.5 rounded text-sm">src/lib/auth-client.ts</code> in your project:
          </p>
          <Tabs
            tabs={[
              {
                label: 'Email OTP',
                content: (
                  <CodeBlock
                    label="src/lib/auth-client.ts"
                    code={`import { createAuthClient } from "better-auth/react";
import { emailOTPClient } from "better-auth/client/plugins";

export const authClient = createAuthClient({
  baseURL: window.location.origin, // proxied to VixAuth
  plugins: [emailOTPClient()],
});

export const { useSession, signOut } = authClient;`}
                    copied={copied}
                    onCopy={copy}
                  />
                ),
              },
              {
                label: 'Phone OTP',
                content: (
                  <CodeBlock
                    label="src/lib/auth-client.ts"
                    code={`import { createAuthClient } from "better-auth/react";
import { phoneNumberClient } from "better-auth/client/plugins";

export const authClient = createAuthClient({
  baseURL: window.location.origin, // proxied to VixAuth
  plugins: [phoneNumberClient()],
});

export const { useSession, signOut } = authClient;`}
                    copied={copied}
                    onCopy={copy}
                  />
                ),
              },
            ]}
          />
        </Section>

        {/* Step 4 */}
        <Section id="proxy" title="4. Configure the proxy">
          <p className="mb-3">
            Route <code className="bg-gray-100 px-1.5 py-0.5 rounded text-sm">/api/auth</code> requests from your frontend to VixAuth.
            Replace <code className="bg-gray-100 px-1.5 py-0.5 rounded text-sm">YOUR_PUBLISHABLE_KEY</code> with your project's publishable key.
          </p>
          <Tabs
            tabs={[
              {
                label: 'Vite',
                content: (
                  <CodeBlock
                    label="vite.config.ts"
                    code={`export default defineConfig({
  server: {
    proxy: {
      '/api/auth': {
        target: '${vixauthUrl}',
        changeOrigin: true,
        rewrite: (path) =>
          \`/auth/YOUR_PUBLISHABLE_KEY\${path}\`,
      },
    },
  },
});`}
                    copied={copied}
                    onCopy={copy}
                  />
                ),
              },
              {
                label: 'Next.js',
                content: (
                  <CodeBlock
                    label="next.config.js"
                    code={`module.exports = {
  async rewrites() {
    return [
      {
        source: '/api/auth/:path*',
        destination:
          '${vixauthUrl}/auth/YOUR_PUBLISHABLE_KEY/api/auth/:path*',
      },
    ];
  },
};`}
                    copied={copied}
                    onCopy={copy}
                  />
                ),
              },
              {
                label: 'Nginx / Production',
                content: (
                  <CodeBlock
                    label="nginx.conf"
                    code={`location /api/auth/ {
    proxy_pass ${vixauthUrl}/auth/YOUR_PUBLISHABLE_KEY/api/auth/;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
}`}
                    copied={copied}
                    onCopy={copy}
                  />
                ),
              },
            ]}
          />
          <Callout>
            In production, use Nginx, Caddy, or your hosting platform's rewrite rules instead of the dev proxy.
            Add your production domain to the project's <strong>Allowed Origins</strong> in the dashboard.
          </Callout>
        </Section>

        {/* Step 5 */}
        <Section id="sign-in" title="5. Implement sign-in">
          <Tabs
            tabs={[
              {
                label: 'Email OTP',
                content: (
                  <CodeBlock
                    label="SignIn.tsx"
                    code={`import { authClient } from "./lib/auth-client";

// Step 1: Send the code
const { error } = await authClient.emailOtp.sendVerificationOtp({
  email: "user@example.com",
  type: "sign-in", // use "sign-in" — auto-creates new users
});

// Step 2: Verify the code
const { error: verifyError } = await authClient.emailOtp.verifyEmail({
  email: "user@example.com",
  otp: "123456",
});

// Step 3: Check the session
const { data: session } = await authClient.useSession();
console.log(session.user); // { id, email, ... }`}
                    copied={copied}
                    onCopy={copy}
                  />
                ),
              },
              {
                label: 'Phone OTP',
                content: (
                  <CodeBlock
                    label="SignIn.tsx"
                    code={`import { authClient } from "./lib/auth-client";

// Step 1: Send the code
const { error } = await authClient.phoneNumber.sendVerificationCode({
  phoneNumber: "+15551234567",
});

// Step 2: Verify the code
const { error: verifyError } = await authClient.phoneNumber.verifyPhoneNumber({
  phoneNumber: "+15551234567",
  code: "123456",
});

// Step 3: Check the session
const { data: session } = await authClient.useSession();
console.log(session.user); // { id, phoneNumber, ... }`}
                    copied={copied}
                    onCopy={copy}
                  />
                ),
              },
            ]}
          />
        </Section>

        {/* Step 6 */}
        <Section id="session-check" title="6. Validate sessions on your backend">
          <p className="mb-3">
            After sign-in, a session cookie is set on your domain. On your backend, extract the
            <code className="bg-gray-100 px-1.5 py-0.5 rounded text-sm">better-auth.session_token</code> cookie and
            query <strong>your own database</strong>:
          </p>
          <CodeBlock
            label="SQL"
            code={`SELECT u.* FROM "session" s
JOIN "user" u ON u.id = s.user_id
WHERE s.token = $1
  AND s.expires_at > NOW();`}
            copied={copied}
            onCopy={copy}
          />
          <CodeBlock
            label="Express example"
            code={`import pg from "pg";
import cookieParser from "cookie-parser";

app.use(cookieParser());

app.get("/api/me", async (req, res) => {
  const token = req.cookies["better-auth.session_token"];
  if (!token) return res.status(401).json({ error: "Not authenticated" });

  const { rows } = await pool.query(
    \`SELECT u.* FROM "session" s
     JOIN "user" u ON u.id = s.user_id
     WHERE s.token = $1 AND s.expires_at > NOW()\`,
    [token.split(".")[0]] // token format: "id.secret"
  );

  if (!rows[0]) return res.status(401).json({ error: "Invalid session" });
  res.json({ user: rows[0] });
});`}
            copied={copied}
            onCopy={copy}
          />
        </Section>

        {/* Step 7 */}
        <Section id="sign-out" title="7. Sign out">
          <CodeBlock
            label="SignOut"
            code={`import { signOut } from "./lib/auth-client";

await signOut();`}
            copied={copied}
            onCopy={copy}
          />
        </Section>

        {/* Allowed Origins */}
        <Section id="allowed-origins" title="Allowed Origins (CORS)">
          <p>
            VixAuth enforces CORS on per-project auth endpoints. Add every domain that will make auth
            requests to your project's <strong>Allowed Origins</strong> list in the dashboard.
          </p>
          <p className="mt-2">
            Example: <code className="bg-gray-100 px-1.5 py-0.5 rounded text-sm">https://myapp.com</code>,
            <code className="bg-gray-100 px-1.5 py-0.5 rounded text-sm">http://localhost:5173</code>
          </p>
        </Section>

        {/* Database Schema */}
        <Section id="schema" title="Database schema">
          <p className="mb-3">
            VixAuth creates these tables in your database when you create a project. They are fully managed — do not modify their structure.
          </p>
          <CodeBlock
            label="Tables created in your database"
            code={`"user"         — id, name, email, phone_number, email_verified, phone_number_verified, image, created_at, updated_at
session        — id, user_id, token, expires_at, ip_address, user_agent, created_at, updated_at
account        — id, user_id, account_id, provider_id, access_token, ...
verification   — id, identifier, value, expires_at, created_at, updated_at`}
            copied={copied}
            onCopy={copy}
          />
        </Section>

        {/* API Keys */}
        <Section id="api-keys" title="Programmatic API access">
          <p className="mb-3">
            You can manage projects programmatically using API keys. Create one in{' '}
            <Link to="/settings" className="text-emerald-600 underline">Settings</Link>.
          </p>
          <CodeBlock
            label="cURL"
            code={`# List your projects
curl -H "Authorization: Bearer vxk_YOUR_API_KEY" \\
  ${vixauthUrl}/api/projects

# Create a project
curl -X POST -H "Authorization: Bearer vxk_YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"name":"My App","database_url":"postgres://...","auth_mode":"email"}' \\
  ${vixauthUrl}/api/projects`}
            copied={copied}
            onCopy={copy}
          />
        </Section>

        {/* Troubleshooting */}
        <Section id="troubleshooting" title="Troubleshooting">
          <div className="space-y-4">
            <TroubleshootItem
              q="I get 'Failed to send code'"
              a="Check that your project's auth mode matches the client plugin (emailOTPClient vs phoneNumberClient). Also verify that VixAuth has valid Resend/Twilio credentials for your auth mode."
            />
            <TroubleshootItem
              q="CORS errors in the browser"
              a="Add your frontend's origin (e.g. http://localhost:5173) to the project's Allowed Origins in the dashboard."
            />
            <TroubleshootItem
              q="Session cookie not being set"
              a="Ensure your proxy is correctly rewriting /api/auth to VixAuth. The cookie's domain must match your frontend's domain."
            />
            <TroubleshootItem
              q="'relation does not exist' errors"
              a="The auth tables weren't created in your database. Delete and re-create the project, or manually run the setup SQL from the schema section above."
            />
          </div>
        </Section>
      </div>
    </div>
  )
}

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="mb-12">
      <h2 className="text-xl font-bold text-gray-900 mb-3">{title}</h2>
      <div className="text-gray-600 text-[15px] leading-relaxed">{children}</div>
    </section>
  )
}

function CodeBlock({ label, code, copied, onCopy }: { label: string; code: string; copied: string; onCopy: (v: string, l: string) => void }) {
  return (
    <div className="bg-gray-950 rounded-xl overflow-hidden mb-4">
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-800">
        <span className="text-xs text-gray-500">{label}</span>
        <button onClick={() => onCopy(code, label)} className="text-gray-500 hover:text-gray-300 transition-colors">
          {copied === label ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
        </button>
      </div>
      <pre className="p-4 text-sm text-gray-300 overflow-x-auto whitespace-pre-wrap">{code}</pre>
    </div>
  )
}

function Tabs({ tabs }: { tabs: { label: string; content: React.ReactNode }[] }) {
  const [active, setActive] = useState(0)
  return (
    <div className="mb-4">
      <div className="flex gap-1 mb-3">
        {tabs.map((t, i) => (
          <button
            key={t.label}
            onClick={() => setActive(i)}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              active === i ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-500 hover:text-gray-900'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tabs[active].content}
    </div>
  )
}

function Callout({ children }: { children: React.ReactNode }) {
  return (
    <div className="border-l-2 border-amber-400 bg-amber-50 px-4 py-3 rounded-r-lg text-sm text-amber-800 mt-4">
      {children}
    </div>
  )
}

function TroubleshootItem({ q, a }: { q: string; a: string }) {
  return (
    <div>
      <h4 className="font-semibold text-gray-900 text-sm">{q}</h4>
      <p className="text-gray-600 text-sm mt-1">{a}</p>
    </div>
  )
}
