-- backend/migrations/0005_add_user_locale.sql
-- UI language preference, e.g. "en" | "th". NULL means "user hasn't
-- explicitly chosen one yet" — the frontend falls back to localStorage,
-- then browser language, then English.
-- No migration runner exists in this project yet — apply manually to the
-- production DB (Supabase) when deploying this feature. Already applied to
-- the local dev Postgres container directly.
--
-- !!! DEPLOY-ORDERING HAZARD — READ BEFORE DEPLOYING THIS FEATURE !!!
-- This migration MUST be applied to the production database (Supabase)
-- BEFORE the backend binary containing the locale feature is deployed to
-- Cloud Run. `Login` and `GetProfile` unconditionally SELECT/COALESCE the
-- `locale` column — if the new backend code reaches production before this
-- column exists, EVERY login and EVERY profile load will 500 for EVERY
-- user until this migration is run. Apply this file first, confirm it
-- succeeded, and only then deploy/promote the new backend revision.

ALTER TABLE users ADD COLUMN IF NOT EXISTS locale TEXT;
