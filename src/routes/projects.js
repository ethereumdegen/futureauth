import { Hono } from "hono";
import { nanoid } from "nanoid";
import { query, queryOne } from "../db.js";
import { setupProjectDatabase, invalidateProjectCache } from "../project-auth.js";

const app = new Hono();

// List projects for the current developer
app.get("/", async (c) => {
  const dev = c.get("developer");
  const projects = await query(
    "SELECT id, name, publishable_key, created_at, updated_at FROM project WHERE developer_id = $1 ORDER BY created_at DESC",
    [dev.id]
  );
  return c.json(projects);
});

// Create a project
app.post("/", async (c) => {
  const dev = c.get("developer");
  const { name, database_url, twilio_account_sid, twilio_auth_token, twilio_phone_number, allowed_origins } = await c.req.json();

  if (!name || !database_url) {
    return c.json({ error: "name and database_url are required" }, 400);
  }

  const id = nanoid();
  const publishableKey = `vx_pub_${nanoid(24)}`;
  const secretKey = `vx_sec_${nanoid(32)}`;

  // Setup BetterAuth tables in the project's database
  try {
    await setupProjectDatabase(database_url);
  } catch (e) {
    return c.json({ error: `Failed to connect to project database: ${e.message}` }, 400);
  }

  const project = await queryOne(
    `INSERT INTO project (id, developer_id, name, publishable_key, secret_key, database_url,
       twilio_account_sid, twilio_auth_token, twilio_phone_number, allowed_origins)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     RETURNING id, name, publishable_key, secret_key, created_at`,
    [id, dev.id, name, publishableKey, secretKey, database_url,
     twilio_account_sid || null, twilio_auth_token || null, twilio_phone_number || null,
     JSON.stringify(allowed_origins || [])]
  );

  return c.json(project, 201);
});

// Get project details
app.get("/:id", async (c) => {
  const dev = c.get("developer");
  const project = await queryOne(
    `SELECT id, name, publishable_key, secret_key, database_url,
       twilio_account_sid, twilio_phone_number, allowed_origins, created_at, updated_at
     FROM project WHERE id = $1 AND developer_id = $2`,
    [c.req.param("id"), dev.id]
  );
  if (!project) return c.json({ error: "Not found" }, 404);
  return c.json(project);
});

// Update project
app.put("/:id", async (c) => {
  const dev = c.get("developer");
  const id = c.req.param("id");
  const body = await c.req.json();

  const existing = await queryOne(
    "SELECT id FROM project WHERE id = $1 AND developer_id = $2",
    [id, dev.id]
  );
  if (!existing) return c.json({ error: "Not found" }, 404);

  const project = await queryOne(
    `UPDATE project SET
       name = COALESCE($3, name),
       twilio_account_sid = COALESCE($4, twilio_account_sid),
       twilio_auth_token = COALESCE($5, twilio_auth_token),
       twilio_phone_number = COALESCE($6, twilio_phone_number),
       allowed_origins = COALESCE($7, allowed_origins),
       updated_at = NOW()
     WHERE id = $1 AND developer_id = $2
     RETURNING id, name, publishable_key, updated_at`,
    [id, dev.id, body.name || null, body.twilio_account_sid || null,
     body.twilio_auth_token || null, body.twilio_phone_number || null,
     body.allowed_origins ? JSON.stringify(body.allowed_origins) : null]
  );

  invalidateProjectCache(id);
  return c.json(project);
});

// Delete project
app.delete("/:id", async (c) => {
  const dev = c.get("developer");
  const res = await query(
    "DELETE FROM project WHERE id = $1 AND developer_id = $2",
    [c.req.param("id"), dev.id]
  );
  invalidateProjectCache(c.req.param("id"));
  return c.body(null, 204);
});

// List end-users in a project
app.get("/:id/users", async (c) => {
  const dev = c.get("developer");
  const project = await queryOne(
    "SELECT database_url FROM project WHERE id = $1 AND developer_id = $2",
    [c.req.param("id"), dev.id]
  );
  if (!project) return c.json({ error: "Not found" }, 404);

  // Query the project's own database for users
  const pg = await import("pg");
  const client = new pg.default.Client({ connectionString: project.database_url });
  await client.connect();
  try {
    const res = await client.query(
      'SELECT id, name, email, "phoneNumber", "phoneNumberVerified", "createdAt" FROM "user" ORDER BY "createdAt" DESC LIMIT 100'
    );
    return c.json(res.rows);
  } finally {
    await client.end();
  }
});

// List active sessions in a project
app.get("/:id/sessions", async (c) => {
  const dev = c.get("developer");
  const project = await queryOne(
    "SELECT database_url FROM project WHERE id = $1 AND developer_id = $2",
    [c.req.param("id"), dev.id]
  );
  if (!project) return c.json({ error: "Not found" }, 404);

  const pg = await import("pg");
  const client = new pg.default.Client({ connectionString: project.database_url });
  await client.connect();
  try {
    const res = await client.query(
      `SELECT s.id, s."userId", s."ipAddress", s."userAgent", s."createdAt", s."expiresAt",
              u."phoneNumber", u.name, u.email
       FROM "session" s LEFT JOIN "user" u ON u.id = s."userId"
       WHERE s."expiresAt" > NOW()
       ORDER BY s."createdAt" DESC LIMIT 100`
    );
    return c.json(res.rows);
  } finally {
    await client.end();
  }
});

export default app;
