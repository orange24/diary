-- "Nosy mode": a feed of other users' public entries, ranked by unique-viewer
-- count then by most recent update. Two pieces:
--
-- 1. entries.updated_at — didn't exist before; UpdateEntry never stamped
--    anything, so there was nothing to sort "most recently updated" by.
--    Stamped by UpdateEntry going forward; existing rows default to their
--    own created_date via the backfill below so old entries don't all tie
--    at the migration's run time.
--
-- 2. entry_views — one row per (entry, viewer) pair, not a raw counter
--    column. This is what makes the count a *unique*-viewer count: a
--    repeat visit is a no-op insert (ON CONFLICT DO NOTHING at the
--    handler level), and the count is just COUNT(*) grouped by entry_id.
--
-- MIGRATION MUST BE APPLIED TO THE PRODUCTION DB (SUPABASE) BEFORE
-- DEPLOYING THIS FEATURE'S BACKEND CODE — the Nosy feed query joins
-- entry_views and reads updated_at unconditionally. No migration runner
-- exists in this project yet. Already applied to the local dev Postgres
-- container directly.

ALTER TABLE entries
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP;

UPDATE entries SET updated_at = created_date WHERE updated_at IS NULL;

ALTER TABLE entries
  ALTER COLUMN updated_at SET DEFAULT CURRENT_TIMESTAMP;

CREATE TABLE IF NOT EXISTS entry_views (
  entry_id INTEGER NOT NULL REFERENCES entries(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  viewed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (entry_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_entry_views_entry_id ON entry_views(entry_id);
