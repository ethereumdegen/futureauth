use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::{FromRow, PgPool};

#[derive(Debug, Clone, FromRow, Serialize, Deserialize)]
pub struct Project {
    pub id: String,
    pub developer_id: String,
    pub name: String,
    pub publishable_key: String,
    #[serde(skip_serializing)]
    pub secret_key_hash: String,
    pub otp_mode: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl Project {
    pub async fn list_for_developer(pool: &PgPool, developer_id: &str) -> Result<Vec<Self>, sqlx::Error> {
        sqlx::query_as::<_, Project>(
            "SELECT * FROM project WHERE developer_id = $1 ORDER BY created_at DESC",
        )
        .bind(developer_id)
        .fetch_all(pool)
        .await
    }

    pub async fn find_by_id(pool: &PgPool, id: &str, developer_id: &str) -> Result<Option<Self>, sqlx::Error> {
        sqlx::query_as::<_, Project>(
            "SELECT * FROM project WHERE id = $1 AND developer_id = $2",
        )
        .bind(id)
        .bind(developer_id)
        .fetch_optional(pool)
        .await
    }

    pub async fn find_by_secret_hash(pool: &PgPool, hash: &str) -> Result<Option<Self>, sqlx::Error> {
        sqlx::query_as::<_, Project>(
            "SELECT * FROM project WHERE secret_key_hash = $1",
        )
        .bind(hash)
        .fetch_optional(pool)
        .await
    }

    pub async fn create(
        pool: &PgPool,
        developer_id: &str,
        name: &str,
        otp_mode: &str,
        publishable_key: &str,
        secret_key_hash: &str,
    ) -> Result<Self, sqlx::Error> {
        let id = nanoid::nanoid!();
        sqlx::query_as::<_, Project>(
            "INSERT INTO project (id, developer_id, name, otp_mode, publishable_key, secret_key_hash)
             VALUES ($1, $2, $3, $4, $5, $6) RETURNING *",
        )
        .bind(&id)
        .bind(developer_id)
        .bind(name)
        .bind(otp_mode)
        .bind(publishable_key)
        .bind(secret_key_hash)
        .fetch_one(pool)
        .await
    }

    pub async fn update(
        pool: &PgPool,
        id: &str,
        developer_id: &str,
        name: Option<&str>,
        otp_mode: Option<&str>,
    ) -> Result<Option<Self>, sqlx::Error> {
        sqlx::query_as::<_, Project>(
            "UPDATE project SET
               name = COALESCE($3, name),
               otp_mode = COALESCE($4, otp_mode),
               updated_at = NOW()
             WHERE id = $1 AND developer_id = $2
             RETURNING *",
        )
        .bind(id)
        .bind(developer_id)
        .bind(name)
        .bind(otp_mode)
        .fetch_optional(pool)
        .await
    }

    pub async fn delete(pool: &PgPool, id: &str, developer_id: &str) -> Result<(), sqlx::Error> {
        sqlx::query("DELETE FROM project WHERE id = $1 AND developer_id = $2")
            .bind(id)
            .bind(developer_id)
            .execute(pool)
            .await?;
        Ok(())
    }
}
