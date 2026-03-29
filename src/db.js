import pg from "pg";

export const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});

export async function query(sql, params = []) {
  const res = await pool.query(sql, params);
  return res.rows;
}

export async function queryOne(sql, params = []) {
  const res = await pool.query(sql, params);
  return res.rows[0] || null;
}
