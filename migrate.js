import { createRequire } from "module";
const require = createRequire(import.meta.url);
require("dotenvy")();

import pg from "pg";
import { readFileSync, readdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

async function migrate() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL is required");
    process.exit(1);
  }

  const client = new pg.Client({ connectionString: url });
  await client.connect();

  // Create migrations tracking table
  await client.query(`
    CREATE TABLE IF NOT EXISTS _migrations (
      name TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  const dir = join(__dirname, "migrations");
  const files = readdirSync(dir).filter(f => f.endsWith(".sql")).sort();

  for (const file of files) {
    const applied = await client.query(
      "SELECT 1 FROM _migrations WHERE name = $1", [file]
    );
    if (applied.rows.length > 0) {
      console.log(`  skip: ${file}`);
      continue;
    }

    const sql = readFileSync(join(dir, file), "utf-8");
    console.log(`  apply: ${file}`);
    await client.query(sql);
    await client.query(
      "INSERT INTO _migrations (name) VALUES ($1)", [file]
    );
  }

  await client.end();
  console.log("Migrations complete");
}

migrate().catch(e => { console.error(e); process.exit(1); });
