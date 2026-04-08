use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::{FromRow, PgPool};

#[derive(Debug, Clone, FromRow, Serialize, Deserialize)]
pub struct Project {
    pub id: String,
    pub user_id: String,
    pub name: String,
    #[serde(skip_serializing)]
    pub secret_key_hash: String,
    pub otp_mode: String,
    pub magic_link_callback_url: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl Project {
    pub async fn list_for_user(pool: &PgPool, user_id: &str) -> Result<Vec<Self>, sqlx::Error> {
        sqlx::query_as::<_, Project>(
            "SELECT * FROM project WHERE user_id = $1 ORDER BY created_at DESC",
        )
        .bind(user_id)
        .fetch_all(pool)
        .await
    }

    pub async fn find_by_id(pool: &PgPool, id: &str, user_id: &str) -> Result<Option<Self>, sqlx::Error> {
        sqlx::query_as::<_, Project>(
            "SELECT * FROM project WHERE id = $1 AND user_id = $2",
        )
        .bind(id)
        .bind(user_id)
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
        user_id: &str,
        name: &str,
        otp_mode: &str,
        secret_key_hash: &str,
    ) -> Result<Self, sqlx::Error> {
        let id = nanoid::nanoid!();
        sqlx::query_as::<_, Project>(
            "INSERT INTO project (id, user_id, name, otp_mode, secret_key_hash)
             VALUES ($1, $2, $3, $4, $5) RETURNING *",
        )
        .bind(&id)
        .bind(user_id)
        .bind(name)
        .bind(otp_mode)
        .bind(secret_key_hash)
        .fetch_one(pool)
        .await
    }

    pub async fn update(
        pool: &PgPool,
        id: &str,
        user_id: &str,
        name: Option<&str>,
        otp_mode: Option<&str>,
        magic_link_callback_url: Option<&str>,
    ) -> Result<Option<Self>, sqlx::Error> {
        sqlx::query_as::<_, Project>(
            "UPDATE project SET
               name = COALESCE($3, name),
               otp_mode = COALESCE($4, otp_mode),
               magic_link_callback_url = COALESCE($5, magic_link_callback_url),
               updated_at = NOW()
             WHERE id = $1 AND user_id = $2
             RETURNING *",
        )
        .bind(id)
        .bind(user_id)
        .bind(name)
        .bind(otp_mode)
        .bind(magic_link_callback_url)
        .fetch_optional(pool)
        .await
    }

    pub async fn regenerate_keys(
        pool: &PgPool,
        id: &str,
        user_id: &str,
        secret_key_hash: &str,
    ) -> Result<Option<Self>, sqlx::Error> {
        sqlx::query_as::<_, Project>(
            "UPDATE project SET
               secret_key_hash = $3,
               updated_at = NOW()
             WHERE id = $1 AND user_id = $2
             RETURNING *",
        )
        .bind(id)
        .bind(user_id)
        .bind(secret_key_hash)
        .fetch_optional(pool)
        .await
    }

    pub async fn delete(pool: &PgPool, id: &str, user_id: &str) -> Result<(), sqlx::Error> {
        sqlx::query("DELETE FROM project WHERE id = $1 AND user_id = $2")
            .bind(id)
            .bind(user_id)
            .execute(pool)
            .await?;
        Ok(())
    }
}
