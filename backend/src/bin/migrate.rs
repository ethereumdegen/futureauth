use sqlx::PgPool;

#[tokio::main]
async fn main() {
    let database_url = std::env::var("DATABASE_URL").expect("DATABASE_URL must be set");
    let fresh = std::env::args().any(|a| a == "--fresh");

    let pool = PgPool::connect(&database_url)
        .await
        .expect("Failed to connect to database");

    if fresh {
        println!("Dropping all tables...");
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
        println!("All tables dropped");
    }

    let sql = include_str!("../../migrations/001_init.sql");
    sqlx::raw_sql(sql)
        .execute(&pool)
        .await
        .expect("Migration failed");

    println!("Migrations complete");
}
