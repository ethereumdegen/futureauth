use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sha2::{Sha256, Digest};
use sqlx::{FromRow, PgPool};

#[derive(Debug, Clone, FromRow, Serialize, Deserialize)]
pub struct DeveloperApiKey {
    pub id: String,
    pub user_id: String,
    pub name: String,
    #[serde(skip_serializing)]
    pub key_hash: String,
    pub key_prefix: String,
    pub created_at: DateTime<Utc>,
    pub last_used_at: Option<DateTime<Utc>>,
}

pub fn hash_key(key: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(key.as_bytes());
    hex::encode(hasher.finalize())
}

impl DeveloperApiKey {
    pub async fn list_for_user(pool: &PgPool, user_id: &str) -> Result<Vec<Self>, sqlx::Error> {
        sqlx::query_as::<_, DeveloperApiKey>(
            "SELECT * FROM developer_api_key WHERE user_id = $1 ORDER BY created_at DESC",
        )
        .bind(user_id)
        .fetch_all(pool)
        .await
    }

    pub async fn create(
        pool: &PgPool,
        user_id: &str,
        name: &str,
        key_hash: &str,
        key_prefix: &str,
    ) -> Result<Self, sqlx::Error> {
        let id = nanoid::nanoid!();
        sqlx::query_as::<_, DeveloperApiKey>(
            "INSERT INTO developer_api_key (id, user_id, name, key_hash, key_prefix)
             VALUES ($1, $2, $3, $4, $5) RETURNING *",
        )
        .bind(&id)
        .bind(user_id)
        .bind(name)
        .bind(key_hash)
        .bind(key_prefix)
        .fetch_one(pool)
        .await
    }

    pub async fn delete(pool: &PgPool, id: &str, user_id: &str) -> Result<(), sqlx::Error> {
        sqlx::query("DELETE FROM developer_api_key WHERE id = $1 AND user_id = $2")
            .bind(id)
            .bind(user_id)
            .execute(pool)
            .await?;
        Ok(())
    }

    /// Resolve an API key to a (user_id, email) from the SDK's "user" table.
    pub async fn resolve_user(pool: &PgPool, raw_key: &str) -> Result<Option<(String, String)>, sqlx::Error> {
        let hash = hash_key(raw_key);
        let row = sqlx::query_as::<_, (String, Option<String>)>(
            r#"SELECT u.id, u.email FROM developer_api_key ak JOIN "user" u ON u.id = ak.user_id WHERE ak.key_hash = $1"#,
        )
        .bind(&hash)
        .fetch_optional(pool)
        .await?;

        if row.is_some() {
            let _ = sqlx::query("UPDATE developer_api_key SET last_used_at = NOW() WHERE key_hash = $1")
                .bind(&hash)
                .execute(pool)
                .await;
        }

        Ok(row.map(|(id, email)| (id, email.unwrap_or_default())))
    }
}
