import { Hono } from "hono";
import { cors } from "hono/cors";
import { serve } from "@hono/node-server";
import { dashboardAuth } from "./dashboard-auth.js";
import { getProjectByKey, getProjectAuth } from "./project-auth.js";
import projectRoutes from "./routes/projects.js";
import apiKeyRoutes, { resolveApiKey } from "./routes/api-keys.js";

const app = new Hono();

const origin = process.env.CORS_ORIGIN || "http://localhost:5180";

// --- CORS for dashboard ---
app.use("/api/*", cors({
  origin,
  credentials: true,
  allowHeaders: ["Content-Type", "Authorization"],
  allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
}));

// --- Dashboard auth (email OTP for developers — VixAuth eats its own dogfood) ---
app.on(["GET", "POST"], "/api/auth/*", (c) => {
  return dashboardAuth.handler(c.req.raw);
});

// --- Dashboard session OR API key middleware for /api/projects and /api/keys ---
app.use("/api/projects/*", authMiddleware);
app.use("/api/keys/*", authMiddleware);

async function authMiddleware(c, next) {
  // Try API key first (Authorization: Bearer vxk_...)
  const authHeader = c.req.header("authorization");
  if (authHeader && authHeader.startsWith("Bearer vxk_")) {
    const key = authHeader.slice(7);
    const developer = await resolveApiKey(key);
    if (!developer) {
      return c.json({ error: "Invalid API key" }, 401);
    }
    c.set("developer", developer);
    return next();
  }

  // Fall back to session auth
  const session = await dashboardAuth.api.getSession({
    headers: c.req.raw.headers,
  });
  if (!session) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  c.set("developer", session.user);
  await next();
}

app.route("/api/projects", projectRoutes);
app.route("/api/keys", apiKeyRoutes);

// --- Per-project auth proxy ---
// Apps send auth requests to /auth/{publishable_key}/api/auth/*
// VixAuth routes them to the correct BetterAuth instance
app.all("/auth/:key/*", async (c) => {
  const key = c.req.param("key");

  const project = await getProjectByKey(key);
  if (!project) {
    return c.json({ error: "Invalid project key" }, 404);
  }

  // Parse allowed origins for CORS
  let origins = [];
  try {
    origins = typeof project.allowed_origins === "string"
      ? JSON.parse(project.allowed_origins)
      : project.allowed_origins || [];
  } catch { origins = []; }

  // Handle CORS preflight
  const reqOrigin = c.req.header("origin");
  if (c.req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": reqOrigin && origins.includes(reqOrigin) ? reqOrigin : origins[0] || "*",
        "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization, Cookie",
        "Access-Control-Allow-Credentials": "true",
        "Access-Control-Max-Age": "86400",
      },
    });
  }

  const auth = getProjectAuth(project);

  // Rewrite URL — strip /auth/:key so BetterAuth sees /api/auth/*
  const url = new URL(c.req.url);
  url.pathname = url.pathname.replace(`/auth/${key}`, "");
  const proxiedReq = new Request(url.toString(), c.req.raw);

  const res = await auth.handler(proxiedReq);

  // Add CORS headers to response
  if (reqOrigin && origins.includes(reqOrigin)) {
    const headers = new Headers(res.headers);
    headers.set("Access-Control-Allow-Origin", reqOrigin);
    headers.set("Access-Control-Allow-Credentials", "true");
    return new Response(res.body, { status: res.status, headers });
  }

  return res;
});

// --- Config (tells dashboard what modes are available) ---
app.get("/api/config", (c) => c.json({
  sms_enabled: !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_PHONE_NUMBER),
}));

// --- Health ---
app.get("/health", (c) => c.json({ status: "ok", service: "vixauth" }));

// --- Static dashboard (production) ---
app.get("*", async (c) => {
  const path = c.req.path;
  // Serve static files from dashboard/dist
  if (path.match(/\.(js|css|svg|png|ico|json|woff2?)$/)) {
    const fs = await import("fs");
    const filePath = `./dashboard/dist${path}`;
    try {
      const content = fs.readFileSync(filePath);
      const ext = path.split(".").pop();
      const types = { js: "application/javascript", css: "text/css", svg: "image/svg+xml", png: "image/png", ico: "image/x-icon", json: "application/json", woff: "font/woff", woff2: "font/woff2" };
      return new Response(content, { headers: { "Content-Type": types[ext] || "application/octet-stream" } });
    } catch { /* fall through to index.html */ }
  }
  // SPA fallback
  try {
    const fs = await import("fs");
    const html = fs.readFileSync("./dashboard/dist/index.html", "utf-8");
    return new Response(html, { headers: { "Content-Type": "text/html" } });
  } catch {
    return c.json({ error: "Dashboard not built" }, 404);
  }
});

// --- Start ---
const port = parseInt(process.env.PORT || "3002", 10);
console.log(`VixAuth starting on port ${port}`);
serve({ fetch: app.fetch, port });
