use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::{FromRow, PgPool};

#[derive(Debug, Clone, FromRow, Serialize, Deserialize)]
pub struct ProjectPlan {
    pub project_id: String,
    pub plan: String,
    pub stripe_customer_id: Option<String>,
    pub stripe_subscription_id: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl ProjectPlan {
    pub fn daily_limit(&self) -> i64 {
        match self.plan.as_str() {
            "pro" => 1000,
            _ => 50,
        }
    }

    pub async fn find_by_project(pool: &PgPool, project_id: &str) -> Result<Option<Self>, sqlx::Error> {
        sqlx::query_as::<_, Self>("SELECT * FROM project_plan WHERE project_id = $1")
            .bind(project_id)
            .fetch_optional(pool)
            .await
    }

    pub async fn find_by_stripe_subscription(pool: &PgPool, subscription_id: &str) -> Result<Option<Self>, sqlx::Error> {
        sqlx::query_as::<_, Self>("SELECT * FROM project_plan WHERE stripe_subscription_id = $1")
            .bind(subscription_id)
            .fetch_optional(pool)
            .await
    }

    pub async fn find_by_stripe_customer(pool: &PgPool, customer_id: &str) -> Result<Option<Self>, sqlx::Error> {
        sqlx::query_as::<_, Self>("SELECT * FROM project_plan WHERE stripe_customer_id = $1")
            .bind(customer_id)
            .fetch_optional(pool)
            .await
    }

    pub async fn upsert(
        pool: &PgPool,
        project_id: &str,
        plan: &str,
        stripe_customer_id: Option<&str>,
        stripe_subscription_id: Option<&str>,
    ) -> Result<Self, sqlx::Error> {
        sqlx::query_as::<_, Self>(
            "INSERT INTO project_plan (project_id, plan, stripe_customer_id, stripe_subscription_id)
             VALUES ($1, $2, $3, $4)
             ON CONFLICT (project_id) DO UPDATE SET
               plan = $2,
               stripe_customer_id = COALESCE($3, project_plan.stripe_customer_id),
               stripe_subscription_id = COALESCE($4, project_plan.stripe_subscription_id),
               updated_at = NOW()
             RETURNING *",
        )
        .bind(project_id)
        .bind(plan)
        .bind(stripe_customer_id)
        .bind(stripe_subscription_id)
        .fetch_one(pool)
        .await
    }

    pub async fn update_plan(pool: &PgPool, project_id: &str, plan: &str) -> Result<(), sqlx::Error> {
        sqlx::query("UPDATE project_plan SET plan = $2, updated_at = NOW() WHERE project_id = $1")
            .bind(project_id)
            .bind(plan)
            .execute(pool)
            .await?;
        Ok(())
    }

    pub async fn update_plan_by_subscription(pool: &PgPool, subscription_id: &str, plan: &str) -> Result<(), sqlx::Error> {
        sqlx::query("UPDATE project_plan SET plan = $2, updated_at = NOW() WHERE stripe_subscription_id = $1")
            .bind(subscription_id)
            .bind(plan)
            .execute(pool)
            .await?;
        Ok(())
    }
}
