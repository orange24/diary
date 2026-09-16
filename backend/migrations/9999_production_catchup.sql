-- PRODUCTION CATCH-UP: brings the production DB from its original bare
-- schema up to what the currently-deployed backend expects. Discovered
-- 2026-09-13 that NONE of migrations 0001-0008 (nor the base `layout`
-- column from diary_backup.sql) had ever been applied to production,
-- meaning every login/register/entry request was failing. Run this once,
-- in full, against the production `diary` database.
--
-- Deliberately excludes: migration 0002 (audience column) and 0006's
-- entry_views table — both belonged to features (audience picker, Nosy
-- feed) that have since been removed from the codebase entirely, so the
-- current code never references them. entries.updated_at (also from 0006)
-- IS still needed and is included below.

-- Base entries columns (diary_backup.sql's original CREATE TABLE, never
-- applied to production).
ALTER TABLE entries ADD COLUMN IF NOT EXISTS layout jsonb;
ALTER TABLE entries ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
UPDATE entries SET updated_at = created_date WHERE updated_at IS NULL;

-- 0001_add_friendships.sql
CREATE TABLE IF NOT EXISTS friendships (
  id SERIAL PRIMARY KEY,
  requester_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  addressee_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted')),
  created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT no_self_friend CHECK (requester_id <> addressee_id),
  CONSTRAINT unique_friend_pair UNIQUE (requester_id, addressee_id)
);
CREATE INDEX IF NOT EXISTS idx_friendships_addressee ON friendships(addressee_id);
CREATE INDEX IF NOT EXISTS idx_friendships_requester ON friendships(requester_id);

-- 0003_add_user_profile_picture.sql
ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_picture TEXT;

-- 0004_add_user_slug.sql
ALTER TABLE users ADD COLUMN IF NOT EXISTS slug TEXT;
WITH base AS (
  SELECT
    id,
    NULLIF(
      regexp_replace(
        regexp_replace(lower(trim(COALESCE(NULLIF(full_name, ''), username))), '[^a-z0-9]+', '-', 'g'),
        '(^-+|-+$)', '', 'g'
      ),
      ''
    ) AS base_slug
  FROM users
),
numbered AS (
  SELECT id, COALESCE(base_slug, 'user') AS base_slug,
         ROW_NUMBER() OVER (PARTITION BY COALESCE(base_slug, 'user') ORDER BY id) AS rn
  FROM base
)
UPDATE users u
SET slug = CASE WHEN numbered.rn = 1 THEN numbered.base_slug ELSE numbered.base_slug || numbered.rn::text END
FROM numbered
WHERE u.id = numbered.id AND u.slug IS NULL;
ALTER TABLE users ALTER COLUMN slug SET NOT NULL;
ALTER TABLE users ADD CONSTRAINT users_slug_unique UNIQUE (slug);

-- 0005_add_user_locale.sql
ALTER TABLE users ADD COLUMN IF NOT EXISTS locale TEXT;

-- 0007_add_friend_groups.sql
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

-- 0008_add_contacts.sql
CREATE TABLE IF NOT EXISTS contacts (
  id SERIAL PRIMARY KEY,
  owner_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  handle VARCHAR(50) NOT NULL CHECK (
    handle <> ''
    AND handle !~ '[[:space:]]'
    AND handle !~ '[]\[(){}^$.*+?|]'
    AND position('\' in handle) = 0
  ),
  relationship VARCHAR(50) NOT NULL DEFAULT '',
  linked_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  link_status VARCHAR(10) CHECK (link_status IN ('pending', 'accepted')),
  created_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (owner_id, handle)
);
CREATE INDEX IF NOT EXISTS idx_contacts_owner_id ON contacts(owner_id);
CREATE INDEX IF NOT EXISTS idx_contacts_linked_user_id ON contacts(linked_user_id);
