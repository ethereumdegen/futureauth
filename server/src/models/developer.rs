use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::{FromRow, PgPool};

#[derive(Debug, Clone, FromRow, Serialize, Deserialize)]
pub struct Developer {
    pub id: String,
    pub name: String,
    pub email: String,
    pub email_verified: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, FromRow)]
pub struct DeveloperSession {
    pub id: String,
    pub developer_id: String,
    pub token: String,
    pub expires_at: DateTime<Utc>,
    pub ip_address: Option<String>,
    pub user_agent: Option<String>,
    pub created_at: DateTime<Utc>,
}

impl Developer {
    pub async fn find_or_create_by_email(pool: &PgPool, email: &str) -> Result<Self, sqlx::Error> {
        if let Some(dev) = Self::find_by_email(pool, email).await? {
            return Ok(dev);
        }
        let id = nanoid::nanoid!();
        sqlx::query_as::<_, Developer>(
            "INSERT INTO developer (id, email, name, email_verified) VALUES ($1, $2, '', TRUE) RETURNING *",
        )
        .bind(&id)
        .bind(email)
        .fetch_one(pool)
        .await
    }

    pub async fn find_by_email(pool: &PgPool, email: &str) -> Result<Option<Self>, sqlx::Error> {
        sqlx::query_as::<_, Developer>("SELECT * FROM developer WHERE email = $1")
            .bind(email)
            .fetch_optional(pool)
            .await
    }

    pub async fn find_by_id(pool: &PgPool, id: &str) -> Result<Option<Self>, sqlx::Error> {
        sqlx::query_as::<_, Developer>("SELECT * FROM developer WHERE id = $1")
            .bind(id)
            .fetch_optional(pool)
            .await
    }
}

impl DeveloperSession {
    pub async fn create(
        pool: &PgPool,
        developer_id: &str,
        ip_address: Option<&str>,
        user_agent: Option<&str>,
    ) -> Result<Self, sqlx::Error> {
        let id = nanoid::nanoid!();
        let token = format!("{}.{}", nanoid::nanoid!(32), nanoid::nanoid!(16));
        let expires_at = Utc::now() + chrono::Duration::days(30);

        sqlx::query_as::<_, DeveloperSession>(
            "INSERT INTO developer_session (id, developer_id, token, expires_at, ip_address, user_agent)
             VALUES ($1, $2, $3, $4, $5, $6) RETURNING *",
        )
        .bind(&id)
        .bind(developer_id)
        .bind(&token)
        .bind(expires_at)
        .bind(ip_address)
        .bind(user_agent)
        .fetch_one(pool)
        .await
    }

    pub async fn find_by_token(pool: &PgPool, token: &str) -> Result<Option<(Developer, Self)>, sqlx::Error> {
        let session = sqlx::query_as::<_, DeveloperSession>(
            "SELECT * FROM developer_session WHERE token = $1 AND expires_at > NOW()",
        )
        .bind(token)
        .fetch_optional(pool)
        .await?;

        let session = match session {
            Some(s) => s,
            None => return Ok(None),
        };

        let dev = Developer::find_by_id(pool, &session.developer_id).await?;
        Ok(dev.map(|d| (d, session)))
    }

    pub async fn delete_by_token(pool: &PgPool, token: &str) -> Result<(), sqlx::Error> {
        sqlx::query("DELETE FROM developer_session WHERE token = $1")
            .bind(token)
            .execute(pool)
            .await?;
        Ok(())
    }
}
