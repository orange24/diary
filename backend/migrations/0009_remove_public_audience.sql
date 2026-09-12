-- Removes "public" as an entry audience. With the Nosy feed gone (see
-- migration 0006's entry_views, now unused), there's no feature left that
-- shows an entry to a non-friend viewer, so "public" is retired: existing
-- public entries become friend-visible, and the value is no longer
-- accepted by the app going forward.
--
-- MIGRATION MUST BE APPLIED TO THE PRODUCTION DB (SUPABASE) BEFORE
-- DEPLOYING THIS CHANGE'S BACKEND CODE. No migration runner exists in this
-- project yet. Already applied to the local dev Postgres container
-- directly.

UPDATE entries SET audience = 'friend' WHERE audience = 'public';

ALTER TABLE entries DROP CONSTRAINT entries_audience_check;

ALTER TABLE entries
  ADD CONSTRAINT entries_audience_check CHECK (audience IN ('private', 'friend'));
