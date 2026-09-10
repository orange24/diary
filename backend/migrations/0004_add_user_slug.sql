-- Public profile URL slug: /<slug> resolves to that user's profile page.
-- Derived from full_name (falling back to username) at registration,
-- slugified and de-duplicated with a numeric suffix on collision. It is
-- immutable after that — no endpoint accepts changes to it.
-- No migration runner exists in this project yet — apply manually to the
-- production DB (Supabase) when deploying this feature. Already applied to
-- the local dev Postgres container directly.

ALTER TABLE users ADD COLUMN IF NOT EXISTS slug TEXT;

-- Backfill existing users deterministically (ordered by id), using the same
-- slugify + numeric-suffix-on-collision rule the Go registration code uses.
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
