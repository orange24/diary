-- Post audience: who an entry is marked visible to. Values only — no
-- cross-user query anywhere in the app enforces this yet (GetEntries/
-- GetEntry are still strictly scoped to the owner's own user_id), since
-- there's no friends-feed or public-feed endpoint to enforce it for.
-- No migration runner exists in this project yet — apply manually to the
-- production DB (Supabase) when deploying this feature. Already applied to
-- the local dev Postgres container directly.

ALTER TABLE entries
  ADD COLUMN IF NOT EXISTS audience VARCHAR(10) NOT NULL DEFAULT 'private'
  CHECK (audience IN ('private', 'friend', 'public'));
