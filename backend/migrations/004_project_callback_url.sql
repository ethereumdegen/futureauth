-- Add magic_link_callback_url to project table
DO $$ BEGIN
    ALTER TABLE project ADD COLUMN magic_link_callback_url TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;
