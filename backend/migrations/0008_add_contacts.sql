-- Relationship Contacts: placeholder people (e.g. "son A") a user can tag in
-- entries without that person needing a Papymory account. If the real person
-- later signs up, the owner can request to link the contact to that real
-- account — the OTHER party must approve (link_status starts 'pending',
-- becomes 'accepted') before the link takes effect anywhere.
--
-- `handle` is what gets typed as "@handle" in entries, exactly mirroring how
-- real friends are tagged via "@username" today. The app enforces
-- letters/digits/underscore only (same charset the existing @mention/#hashtag
-- trigger already uses, Unicode letters included — this is a Thai-language
-- app, handles need not be ASCII). The CHECK below is a defense-in-depth
-- backstop, not the primary validation: it blocks whitespace and every ERE
-- metacharacter so the column can never hold something unsafe to
-- concatenate directly into a Postgres regex in the feed-visibility query,
-- regardless of what future code path writes to it.
--
-- No migration runner exists in this project yet — apply manually to the
-- production DB (Supabase) when deploying this feature. Already applied to
-- the local dev Postgres container directly.

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
