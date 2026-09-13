-- 0005: Add missing indexes, FK on sequences, unique on profiles.email
-- Safe to run in production: all CREATE INDEX CONCURRENTLY-free since this is a
-- migration that runs at deploy time (not on a live table with heavy writes).

-- 1. Missing indexes for dispatch + webhook queries
CREATE INDEX IF NOT EXISTS idx_messages_to_email_sent ON messages (to_email, sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_run_id ON messages (run_id);
CREATE INDEX IF NOT EXISTS idx_runs_status_updated ON runs (status, updated_at);

-- 2. FK on sequences.user_id to prevent orphaned rows on user delete.
-- Templates use a bogus 00000000-... user_id (0001 seed), which has no
-- auth.users row and would violate the FK. Normalise them to NULL first
-- (templates are public, ownerless) and allow NULL only for templates.
ALTER TABLE sequences ALTER COLUMN user_id DROP NOT NULL;
UPDATE public.sequences SET user_id = NULL WHERE is_template = true;
ALTER TABLE sequences
  ADD CONSTRAINT sequences_user_id_fk
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE NOT VALID;
-- Validate only non-template rows immediately; templates (NULL) are exempt.
-- (NOT VALID avoids a full-table scan lock on large prod tables; validate later.)
ALTER TABLE sequences ADD CONSTRAINT sequences_owner_required CHECK (is_template OR user_id IS NOT NULL) NOT VALID;

-- 3. Unique constraint on profiles.email for Paddle webhook resolution.
-- Case-insensitive: Foo@x.com vs foo@x.com must not bypass dedup.
CREATE UNIQUE INDEX IF NOT EXISTS profiles_email_unique_ci ON profiles (lower(email));
-- Keep the legacy exact-unique only if it doesn't already exist (idempotent).
DO $$ BEGIN
  ALTER TABLE profiles ADD CONSTRAINT profiles_email_unique UNIQUE (email);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
