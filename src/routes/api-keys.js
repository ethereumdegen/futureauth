import { Hono } from "hono";
import { nanoid } from "nanoid";
import { createHash } from "crypto";
import { query, queryOne } from "../db.js";

const app = new Hono();

function hashKey(key) {
  return createHash("sha256").update(key).digest("hex");
}

// List API keys for the current developer
app.get("/", async (c) => {
  const dev = c.get("developer");
  const keys = await query(
    `SELECT id, name, key_prefix, created_at, last_used_at
     FROM developer_api_key WHERE developer_id = $1
     ORDER BY created_at DESC`,
    [dev.id]
  );
  return c.json(keys);
});

// Create an API key
app.post("/", async (c) => {
  const dev = c.get("developer");
  const body = await c.req.json();
  const name = body.name || "Untitled";

  const rawKey = `vxk_${nanoid(40)}`;
  const prefix = rawKey.slice(0, 12) + "...";
  const hash = hashKey(rawKey);
  const id = nanoid();

  await queryOne(
    `INSERT INTO developer_api_key (id, developer_id, name, key_hash, key_prefix)
     VALUES ($1, $2, $3, $4, $5) RETURNING id`,
    [id, dev.id, name, hash, prefix]
  );

  // Return the full key ONCE — it can never be retrieved again
  return c.json({ id, name, key: rawKey, key_prefix: prefix, created_at: new Date().toISOString() }, 201);
});

// Delete an API key
app.delete("/:id", async (c) => {
  const dev = c.get("developer");
  await query(
    "DELETE FROM developer_api_key WHERE id = $1 AND developer_id = $2",
    [c.req.param("id"), dev.id]
  );
  return c.body(null, 204);
});

export default app;

// Resolve a developer from an API key (used by middleware)
export async function resolveApiKey(rawKey) {
  const hash = createHash("sha256").update(rawKey).digest("hex");
  const row = await queryOne(
    `SELECT ak.developer_id, u.id, u.name, u.email
     FROM developer_api_key ak
     JOIN "user" u ON u.id = ak.developer_id
     WHERE ak.key_hash = $1`,
    [hash]
  );
  if (row) {
    // Update last_used_at in background
    query("UPDATE developer_api_key SET last_used_at = NOW() WHERE key_hash = $1", [hash]);
  }
  return row;
}
