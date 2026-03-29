use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sha2::{Sha256, Digest};
use sqlx::{FromRow, PgPool};

use super::developer::Developer;

#[derive(Debug, Clone, FromRow, Serialize, Deserialize)]
pub struct DeveloperApiKey {
    pub id: String,
    pub developer_id: String,
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
    pub async fn list_for_developer(pool: &PgPool, developer_id: &str) -> Result<Vec<Self>, sqlx::Error> {
        sqlx::query_as::<_, DeveloperApiKey>(
            "SELECT * FROM developer_api_key WHERE developer_id = $1 ORDER BY created_at DESC",
        )
        .bind(developer_id)
        .fetch_all(pool)
        .await
    }

    pub async fn create(
        pool: &PgPool,
        developer_id: &str,
        name: &str,
        key_hash: &str,
        key_prefix: &str,
    ) -> Result<Self, sqlx::Error> {
        let id = nanoid::nanoid!();
        sqlx::query_as::<_, DeveloperApiKey>(
            "INSERT INTO developer_api_key (id, developer_id, name, key_hash, key_prefix)
             VALUES ($1, $2, $3, $4, $5) RETURNING *",
        )
        .bind(&id)
        .bind(developer_id)
        .bind(name)
        .bind(key_hash)
        .bind(key_prefix)
        .fetch_one(pool)
        .await
    }

    pub async fn delete(pool: &PgPool, id: &str, developer_id: &str) -> Result<(), sqlx::Error> {
        sqlx::query("DELETE FROM developer_api_key WHERE id = $1 AND developer_id = $2")
            .bind(id)
            .bind(developer_id)
            .execute(pool)
            .await?;
        Ok(())
    }

    pub async fn resolve(pool: &PgPool, raw_key: &str) -> Result<Option<Developer>, sqlx::Error> {
        let hash = hash_key(raw_key);
        let row = sqlx::query_as::<_, Developer>(
            "SELECT d.* FROM developer_api_key ak JOIN developer d ON d.id = ak.developer_id WHERE ak.key_hash = $1",
        )
        .bind(&hash)
        .fetch_optional(pool)
        .await?;

        if row.is_some() {
            // Update last_used_at in background (best effort)
            let _ = sqlx::query("UPDATE developer_api_key SET last_used_at = NOW() WHERE key_hash = $1")
                .bind(&hash)
                .execute(pool)
                .await;
        }

        Ok(row)
    }
}
