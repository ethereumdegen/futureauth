use chrono::{DateTime, NaiveDate, Utc};
use serde::{Deserialize, Serialize};
use sqlx::{FromRow, PgPool};

#[derive(Debug, Clone, FromRow, Serialize, Deserialize)]
pub struct DailyUsage {
    pub project_id: String,
    pub usage_date: NaiveDate,
    pub unique_emails: Vec<String>,
    pub email_count: i32,
    pub created_at: DateTime<Utc>,
}

impl DailyUsage {
    /// Record an email for today's usage. Returns (current_count, is_new_email).
    pub async fn record_email(
        pool: &PgPool,
        project_id: &str,
        email: &str,
    ) -> Result<(i32, bool), sqlx::Error> {
        // Upsert: add email to array if not present, update count
        let row: (i32, bool) = sqlx::query_as(
            "INSERT INTO daily_usage (project_id, usage_date, unique_emails, email_count)
             VALUES ($1, CURRENT_DATE, ARRAY[$2::text], 1)
             ON CONFLICT (project_id, usage_date) DO UPDATE SET
               unique_emails = CASE
                 WHEN $2 = ANY(daily_usage.unique_emails) THEN daily_usage.unique_emails
                 ELSE array_append(daily_usage.unique_emails, $2)
               END,
               email_count = CASE
                 WHEN $2 = ANY(daily_usage.unique_emails) THEN daily_usage.email_count
                 ELSE daily_usage.email_count + 1
               END
             RETURNING email_count, NOT ($2 = ANY(daily_usage.unique_emails))",
        )
        .bind(project_id)
        .bind(email)
        .fetch_one(pool)
        .await?;

        Ok(row)
    }

    /// Get today's unique email count for a project.
    pub async fn get_today_count(pool: &PgPool, project_id: &str) -> Result<i32, sqlx::Error> {
        let count: Option<i32> = sqlx::query_scalar(
            "SELECT email_count FROM daily_usage WHERE project_id = $1 AND usage_date = CURRENT_DATE",
        )
        .bind(project_id)
        .fetch_optional(pool)
        .await?;

        Ok(count.unwrap_or(0))
    }
}
