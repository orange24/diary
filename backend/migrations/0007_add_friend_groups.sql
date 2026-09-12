-- Friend Groups: lets a user organize their own friends into custom groups
-- (e.g. "Family", "Close friends") and scope a "friend"-audience entry to
-- specific group(s) instead of always broadcasting to every friend.
--
-- A group is private to its owner — the friends inside it are never told
-- which group they're in, only whether they can see a given post.
--
-- entries.audience stays the plain 3-value enum it already was (migration
-- 0002) — no change there. Scoping is expressed entirely by presence/
-- absence of rows in entry_friend_groups: an audience='friend' entry with
-- NO rows there means "all friends" (this is what makes every entry that
-- predates this feature, and any new one where the author doesn't pick a
-- group, behave as "all friends" with zero migration/backfill needed).
--
-- No migration runner exists in this project yet — apply manually to the
-- production DB (Supabase) when deploying this feature. Already applied to
-- the local dev Postgres container directly.

CREATE TABLE IF NOT EXISTS friend_groups (
  id SERIAL PRIMARY KEY,
  owner_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(50) NOT NULL,
  created_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_friend_groups_owner_id ON friend_groups(owner_id);

CREATE TABLE IF NOT EXISTS friend_group_members (
  group_id INTEGER NOT NULL REFERENCES friend_groups(id) ON DELETE CASCADE,
  friend_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY (group_id, friend_user_id)
);

CREATE TABLE IF NOT EXISTS entry_friend_groups (
  entry_id INTEGER NOT NULL REFERENCES entries(id) ON DELETE CASCADE,
  group_id INTEGER NOT NULL REFERENCES friend_groups(id) ON DELETE CASCADE,
  PRIMARY KEY (entry_id, group_id)
);

CREATE INDEX IF NOT EXISTS idx_entry_friend_groups_entry_id ON entry_friend_groups(entry_id);
