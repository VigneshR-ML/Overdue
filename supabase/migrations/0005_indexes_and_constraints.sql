-- 0005: Add missing indexes, FK on sequences, unique on profiles.email
-- Safe to run in production: all CREATE INDEX CONCURRENTLY-free since this is a
-- migration that runs at deploy time (not on a live table with heavy writes).

-- 1. Missing indexes for dispatch + webhook queries
CREATE INDEX IF NOT EXISTS idx_messages_to_email_sent ON messages (to_email, sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_run_id ON messages (run_id);
CREATE INDEX IF NOT EXISTS idx_runs_status_updated ON runs (status, updated_at);

-- 2. FK on sequences.user_id to prevent orphaned rows on user delete
ALTER TABLE sequences
  ADD CONSTRAINT sequences_user_id_fk
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- 3. Unique constraint on profiles.email for Paddle webhook resolution
ALTER TABLE profiles
  ADD CONSTRAINT profiles_email_unique UNIQUE (email);
