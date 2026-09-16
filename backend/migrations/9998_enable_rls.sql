-- Locks down Supabase's auto-generated PostgREST API, which exposes every
-- public-schema table over HTTP by default unless Row-Level Security (RLS)
-- is enabled. This app never uses that API (or the supabase-js client) —
-- the Go backend connects directly to Postgres as the table owner, which
-- always bypasses RLS regardless of policies — so enabling RLS here with
-- zero policies is a pure lockdown of an API surface the app doesn't use,
-- with no effect on the app itself.
--
-- Without this, anyone with the project's anon API key could read/write/
-- delete every row in every table below directly over HTTP, including
-- users.password (bcrypt hashes) and every other user's personal info.

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE friendships ENABLE ROW LEVEL SECURITY;
ALTER TABLE friend_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE friend_group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE entry_friend_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
