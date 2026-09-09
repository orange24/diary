# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

A personal diary web app: a Go/Gin REST API backend and a Next.js (App Router) frontend, backed by Postgres, with media uploads stored on Cloudinary. Local dev runs via Docker Compose; production runs on Google Cloud Run (backend) with Postgres on Supabase.

## Commands

### Frontend (`frontend/`)
```bash
npm run dev      # start Next.js dev server (localhost:3000)
npm run build    # production build
npm run start    # run production build
npm run lint     # eslint
```
No test runner is configured in the frontend.

### Backend (`backend/`)
```bash
go run ./cmd/main.go   # start API server (default port 9090, overridden by $PORT)
air                    # hot-reload dev server (config in backend/.air.toml, uses ./tmp/main)
go build -o ./tmp/main ./cmd/main.go
go test ./...          # no test files currently exist in the repo
```

### Full stack via Docker
```bash
docker-compose up --build
```
Brings up Postgres (`5433:5432`), backend (`9090:8888`), and frontend (`3000:3000`). Note the backend's `docker-compose.yml` env currently points `DATABASE_URL` at a remote Supabase host rather than the local `db` service — check this before relying on the compose DB.

## Architecture

### Backend (`backend/`)
Single-binary Gin API, entry point `cmd/main.go`, which wires everything together:
- `config/` — loads env vars (`.env` via godotenv, or Cloud Run env), builds the Postgres DSN (`DATABASE_URL` takes precedence over discrete `DB_HOST`/`DB_PORT`/etc.)
- `internal/database/` — raw `database/sql` + `lib/pq` connection (no ORM)
- `internal/models/` — `Entry` and `User` structs (also double as request/response DTOs — `Password` is tagged `omitempty` to avoid leaking it in JSON responses)
- `internal/handlers/` — all handlers hang off one shared `EntryHandler{DB *sql.DB}` struct spanning both `auth_handler.go` (register/login) and `diary_handler.go` (CRUD entries + Cloudinary upload)
- `internal/middleware/auth.go` — validates the `Authorization: Bearer <jwt>` header and injects `user_id` into the Gin context; every entry query is scoped by this `user_id` (ownership is enforced at the SQL `WHERE`/row-count level, not in a separate authorization layer)
- `internal/utils/jwt.go` — HS256 JWT sign/verify, secret from `API_KEY` env var, 24h expiry

Routing (in `cmd/main.go`): `/register` and `/login` are public; `/entries*` and `/upload` sit behind `authorized := r.Group("/")` with `AuthMiddleware`. Static uploads are also served from `./uploads` (legacy — new uploads go to Cloudinary via `UploadFiles`, which returns hosted `SecureURL`s that the frontend stores in `Entry.Images`).

CORS in `cmd/main.go` currently only allows `http://localhost:3000` — update this alongside any deployed frontend origin change.

### Frontend (`frontend/`, Next.js App Router)
- `src/app/` — routes: `/` (dashboard, client component), `/login`, `/register`
- `src/context/auth-context.tsx` — `AuthProvider`/`useAuth`; token + user persisted to `localStorage` (`diary_token`, `user`), gates rendering on `isLoading` to avoid a logged-out flash, and redirects to `/login` when there's no token
- `src/services/api.ts` / `src/services/auth.ts` — thin `fetch` wrappers against the Go backend, base URL from `NEXT_PUBLIC_API_BASE_URL` (`.env.local`); all authenticated calls take the JWT as an explicit argument (not an interceptor) and attach it as `Authorization: Bearer <token>`
- `src/app/page.tsx` — main dashboard: paginated/infinite-scroll entry list (`react-intersection-observer`) via `DiaryGrid`, create/edit through a modal-hosted `DiaryForm`, delete via `AlertDialog` confirmation, plus a "weekly theme" that auto-sets the color theme (`lib/theme-utils.ts`) unless the user already picked one
- `src/components/ui/` — shadcn/radix-ui primitives (generated via `components.json`, style `radix-nova`, base color `neutral`); treat as generated — prefer composing over hand-editing unless fixing a real bug
- Rich text editing is built on Tiptap (`@tiptap/react`, `starter-kit`, `extension-code-block-lowlight`); `Editor.tsx`/`RichTextEditor.tsx` are the entry components for `DiaryForm`'s content field. Rendered HTML content is sanitized with `dompurify`/`isomorphic-dompurify` before display.
- `next.config.ts` sets `ignoreBuildErrors`/`ignoreDuringBuilds` for TS and ESLint — production builds do **not** fail on type or lint errors, so don't rely on `npm run build` to catch these; run `npm run lint`/`tsc` explicitly when verifying changes.

### Data model
`entries` table: `id, title, content, created_date, created_by, images (text[]), user_id`. `users` table: `id, username, password (bcrypt), full_name, birthdate, gender, country`, plus social links (`facebook_link`, `gmail_link`, `apple_id_link`, `x_link`). See `diary_backup.sql` for the schema/reference data dump.

## Notes
- Secrets (DB password, Cloudinary URL, JWT signing) currently appear directly in `docker-compose.yml` / `.env` files committed or present in the working tree — be careful not to further hardcode or propagate these, and flag if asked to commit env files.
- Many source comments and UI strings are in Thai; preserve this when editing existing files rather than translating.
