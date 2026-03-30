-- Remove unused publishable_key column
DROP INDEX IF EXISTS idx_project_pub_key;
ALTER TABLE project DROP COLUMN IF EXISTS publishable_key;
