use futureauth::{FutureAuth, FutureAuthConfig};
use sqlx::{PgPool, Row};
use std::time::Instant;

const MIGRATIONS: &[(&str, &str)] = &[
    ("001_init.sql", include_str!("../../migrations/001_init.sql")),
    ("002_drop_publishable_key.sql", include_str!("../../migrations/002_drop_publishable_key.sql")),
    ("003_otp_log.sql", include_str!("../../migrations/003_otp_log.sql")),
    ("004_project_callback_url.sql", include_str!("../../migrations/004_project_callback_url.sql")),
    ("005_otp_log_project_id.sql", include_str!("../../migrations/005_otp_log_project_id.sql")),
    ("006_billing.sql", include_str!("../../migrations/006_billing.sql")),
];

#[tokio::main]
async fn main() {
    dotenvy::dotenv().ok();
    let database_url = std::env::var("DATABASE_URL").expect("DATABASE_URL must be set");
    let fresh = std::env::args().any(|a| a == "--fresh");

    // Mask password in connection string for display
    let display_url = if let Some(at) = database_url.find('@') {
        if let Some(colon) = database_url[..at].rfind(':') {
            format!("{}:****{}", &database_url[..colon], &database_url[at..])
        } else {
            database_url.clone()
        }
    } else {
        database_url.clone()
    };

    println!("┌─────────────────────────────────────────────┐");
    println!("│         FutureAuth Database Migration        │");
    println!("└─────────────────────────────────────────────┘");
    println!();
    println!("  Database:  {}", display_url);
    println!("  Mode:      {}", if fresh { "FRESH (drop all + recreate)" } else { "Standard (incremental)" });
    println!();

    println!("→ Connecting to database...");
    let start = Instant::now();
    let pool = PgPool::connect(&database_url)
        .await
        .expect("Failed to connect to database");
    println!("  ✓ Connected ({:.0?})", start.elapsed());

    // Show current database state
    let tables: Vec<String> = sqlx::query_scalar(
        "SELECT tablename::text FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename"
    )
    .fetch_all(&pool)
    .await
    .unwrap_or_default();

    if tables.is_empty() {
        println!("  ℹ No existing tables found (fresh database)");
    } else {
        println!("  ℹ Existing tables ({}): {}", tables.len(), tables.join(", "));
    }
    println!();

    if fresh {
        println!("→ Dropping all tables...");
        let drop_start = Instant::now();

        for table in &tables {
            println!("  ✗ Dropping: {}", table);
        }

        sqlx::raw_sql(
            "DO $$ DECLARE r RECORD;
             BEGIN
               FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') LOOP
                 EXECUTE 'DROP TABLE IF EXISTS ' || quote_ident(r.tablename) || ' CASCADE';
               END LOOP;
             END $$;"
        )
        .execute(&pool)
        .await
        .expect("Failed to drop tables");
        println!("  ✓ Dropped {} table(s) ({:.0?})", tables.len(), drop_start.elapsed());
        println!();
    }

    // Run server-owned migrations in order
    for (name, sql) in MIGRATIONS {
        println!("→ Running migration: {}", name);

        // Parse and display what the migration will do
        for line in sql.lines() {
            let trimmed = line.trim();
            if trimmed.starts_with("CREATE TABLE") {
                let parsed = trimmed
                    .strip_prefix("CREATE TABLE IF NOT EXISTS ")
                    .or_else(|| trimmed.strip_prefix("CREATE TABLE "))
                    .and_then(|s| s.split(|c: char| c == '(' || c.is_whitespace()).next())
                    .unwrap_or("?");
                println!("  + Table:  {}", parsed);
            } else if trimmed.starts_with("CREATE INDEX") {
                let parsed = trimmed
                    .strip_prefix("CREATE INDEX IF NOT EXISTS ")
                    .or_else(|| trimmed.strip_prefix("CREATE INDEX "))
                    .and_then(|s| s.split_whitespace().next())
                    .unwrap_or("?");
                println!("  + Index:  {}", parsed);
            } else if trimmed.starts_with("ALTER TABLE") {
                println!("  ~ {}", trimmed.trim_end_matches(';'));
            } else if trimmed.starts_with("DROP ") {
                println!("  - {}", trimmed.trim_end_matches(';'));
            }
        }

        let mig_start = Instant::now();
        if let Err(e) = sqlx::raw_sql(sql).execute(&pool).await {
            eprintln!("  ✗ Migration {} failed: {}", name, e);
            std::process::exit(1);
        }
        println!("  ✓ Applied ({:.0?})", mig_start.elapsed());
        println!();
    }

    // Run SDK migrations (creates "user", session, verification tables)
    println!("→ Running SDK migrations (ensure_tables)");
    let auth = FutureAuth::new(
        pool.clone(),
        FutureAuthConfig {
            api_url: "http://127.0.0.1".to_string(),
            secret_key: "unused-self-hosted".to_string(),
            project_name: "FutureAuth".to_string(),
            ..Default::default()
        },
    );
    let sdk_start = Instant::now();
    if let Err(e) = auth.ensure_tables().await {
        eprintln!("  ✗ SDK ensure_tables failed: {}", e);
        std::process::exit(1);
    }
    println!("  ✓ SDK tables ready ({:.0?})", sdk_start.elapsed());
    println!();

    // Show final state
    let final_tables: Vec<String> = sqlx::query_scalar(
        "SELECT tablename::text FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename"
    )
    .fetch_all(&pool)
    .await
    .unwrap_or_default();

    let total_rows: i64 = {
        let mut total = 0i64;
        for table in &final_tables {
            let count: i64 = sqlx::query(&format!("SELECT COUNT(*) FROM {}", table))
                .fetch_one(&pool)
                .await
                .map(|row| row.get::<i64, _>(0))
                .unwrap_or(0);
            println!("  {:.<30} {} row(s)", table, count);
            total += count;
        }
        total
    };

    println!();
    println!("  Total: {} table(s), {} row(s)", final_tables.len(), total_rows);
    println!("  Done in {:.0?}", start.elapsed());
    println!();
}
