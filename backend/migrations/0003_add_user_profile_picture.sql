-- Profile picture: stored as a data: URI (resized+compressed client-side)
-- rather than a Cloudinary URL, since registration happens before the user
-- has a JWT and the existing /upload endpoint requires one.
-- No migration runner exists in this project yet — apply manually to the
-- production DB (Supabase) when deploying this feature. Already applied to
-- the local dev Postgres container directly.

ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_picture TEXT;
