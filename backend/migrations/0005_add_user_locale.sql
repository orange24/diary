-- backend/migrations/0005_add_user_locale.sql
-- UI language preference, e.g. "en" | "th". NULL means "user hasn't
-- explicitly chosen one yet" — the frontend falls back to localStorage,
-- then browser language, then English.
-- No migration runner exists in this project yet — apply manually to the
-- production DB (Supabase) when deploying this feature. Already applied to
-- the local dev Postgres container directly.

ALTER TABLE users ADD COLUMN IF NOT EXISTS locale TEXT;
