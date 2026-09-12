-- Removes the "audience" concept entirely. Every entry is now private to
-- its owner except for whoever it @-tags (by username or an approved
-- Contact handle) among the owner's accepted friends — automatic, with no
-- manual private/friend switch. "public" was already retired to "friend"
-- by migration 0009; this migration folds "friend" into the same implicit
-- behavior and drops the column, since there's no longer a distinct
-- "private" state to store — visibility is computed from tags alone.
--
-- MIGRATION MUST BE APPLIED TO THE PRODUCTION DB (SUPABASE) BEFORE
-- DEPLOYING THIS CHANGE'S BACKEND CODE. No migration runner exists in this
-- project yet. Already applied to the local dev Postgres container
-- directly.

ALTER TABLE entries DROP CONSTRAINT IF EXISTS entries_audience_check;
ALTER TABLE entries DROP COLUMN IF EXISTS audience;
