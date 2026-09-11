# Multi-Language (i18n) Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users switch the app's UI language (English/Thai, extensible) via
a switcher in the header and on the pre-login pages, with the choice
persisted to their account, covering the header, main dashboard shell, and
login/register as the first translated surfaces.

**Architecture:** A `LocaleProvider` React context (mirrors the existing
`AuthProvider` pattern) exposes `locale`/`setLocale`/`t()` app-wide via
`useLocale()`. No URL routing changes. Typed dictionaries
(`frontend/src/locales/{en,th}.ts`) are the translation source, checked at
compile time via a shared `Dictionary` interface. Backend error responses
gain a stable `error_code` field (via a new `apierr` package) alongside the
existing English `error` text, so the frontend can translate them; services
throw a typed `ApiError` carrying that code, and UI call sites translate it
at the point where a hook is available (not inside the plain service
functions, which can't call React hooks).

**Tech Stack:** Next.js App Router (frontend), Go/Gin + `lib/pq` (backend),
Postgres. No new dependencies — no i18n library, per the design's decision.

**Spec:** `docs/superpowers/specs/2026-09-11-multilanguage-design.md`

## Global Constraints

- No test runner is configured in the frontend, and the backend has
  `go test ./...` wired but zero test files exist yet (per
  `/Volumes/Work/Projects/diary_app/CLAUDE.md`). Every task's "verify" steps
  use `go build`, `npx tsc --noEmit`, `docker compose build/up`, `curl`, and
  manual browser interaction instead of a test runner — this matches how
  every other feature in this codebase has been verified so far. Do not
  invent `npm test`/`go test` commands that don't apply.
- No migration runner exists — every migration is applied manually via
  `docker exec -i diary-db psql -U postgres -d diary < path/to/migration.sql`
  against the local dev Postgres container, same as
  `backend/migrations/0001`–`0004`.
- Never stage files with `git add -A` or `git add .` — stage the exact files
  each task touches, by name.
- Preserve existing Thai code comments (per `CLAUDE.md`) — this plan only
  changes user-facing strings (moving them into dictionaries), not comments.
- After any `docker compose build frontend && docker compose up -d frontend`,
  open a **fresh** browser tab before testing — this project's Next.js dev
  container has served stale bundles to already-open tabs before.
- This plan covers **Phase 1 only** (header, dashboard shell, login,
  register, and their toasts/alerts). `diary-grid.tsx`, `diary-form.tsx`,
  `friends-explorer.tsx`, `hashtag-explorer.tsx`, and the profile pages stay
  English for now — they get their own Phase 2 plan. Backend error codes are
  rolled out to **every** handler now (a uniform, low-risk mechanical change
  worth doing in one pass), even though only some of those errors are
  user-visible as translated toasts yet.

---

## File Structure

**Backend — new:**
- `backend/internal/apierr/apierr.go` — error code constants + JSON response helper
- `backend/migrations/0005_add_user_locale.sql` — adds `users.locale`

**Backend — modified:**
- `backend/internal/middleware/auth.go`, `backend/internal/handlers/auth_handler.go`,
  `backend/internal/handlers/diary_handler.go`, `backend/internal/handlers/friend_handler.go`,
  `backend/internal/handlers/profile_handler.go` — every `gin.H{"error": ...}`
  response becomes an `apierr.JSON(...)` call
- `backend/internal/models/user.go` — adds `Locale string`
- `backend/cmd/main.go` — adds the `PUT /profile/locale` route

**Frontend — new:**
- `frontend/src/locales/types.ts` — `Locale`, `ErrorCode`, `Dictionary`, `TranslationKey` types
- `frontend/src/locales/en.ts`, `frontend/src/locales/th.ts` — the two dictionaries
- `frontend/src/locales/index.ts` — `DICTIONARIES`, `SUPPORTED_LOCALES`
- `frontend/src/lib/api-error.ts` — `ApiError` class + `apiError()` helper
- `frontend/src/lib/i18n.ts` — `translate()`, `translateError()`
- `frontend/src/context/locale-context.tsx` — `LocaleProvider`, `useLocale()`
- `frontend/src/components/language-link-switcher.tsx` — small pre-login switcher (login/register)

**Frontend — modified:**
- `frontend/src/app/layout.tsx` — wraps children in `LocaleProvider`
- `frontend/src/context/auth-context.tsx` — `UserData` gains `locale?: string`
- `frontend/src/services/api.ts`, `frontend/src/services/auth.ts`,
  `frontend/src/services/friends.ts` — throw `ApiError` instead of plain `Error`;
  `auth.ts` gains `updateLocale()` and `ProfileData.locale`
- `frontend/src/components/diary-header.tsx` — language switcher + translated nav/menu strings
- `frontend/src/app/page.tsx`, `frontend/src/components/new-entry-composer.tsx`,
  `frontend/src/lib/entry-placeholder.ts`, `frontend/src/components/diary-form.tsx` (one line) —
  translated dashboard-shell strings
- `frontend/src/app/login/page.tsx`, `frontend/src/app/register/page.tsx` — translated strings + switcher
- `frontend/src/lib/date-format.ts` — locale-aware date/relative-time strings

---

### Task 1: Backend — `apierr` package + `middleware/auth.go`

**Files:**
- Create: `backend/internal/apierr/apierr.go`
- Modify: `backend/internal/middleware/auth.go`

**Interfaces:**
- Produces: `apierr.JSON(c *gin.Context, status int, code string, englishMessage string)` and
  exported string constants (`apierr.Unauthorized`, `apierr.InvalidToken`, plus the full set
  other tasks will use: `apierr.ValidationFailed`, `apierr.InternalError`,
  `apierr.SlugGenerationFailed`, `apierr.RegistrationFailed`, `apierr.InvalidCredentials`,
  `apierr.TokenGenerationFailed`, `apierr.CannotFriendSelf`, `apierr.AlreadyFriends`,
  `apierr.FriendRequestSent`, `apierr.InvalidFriendshipID`, `apierr.RequestNotFound`,
  `apierr.FriendshipNotFound`, `apierr.EntryCreateFailed`, `apierr.EntryUpdateFailed`,
  `apierr.EntryDeleteFailed`, `apierr.EntryNotFound`, `apierr.NoPermission`,
  `apierr.StorageNotConfigured`, `apierr.StorageInitFailed`, `apierr.InvalidFormData`,
  `apierr.UploadFailed`, `apierr.ProfileNotFound`) — defined all at once here even though
  only `Unauthorized`/`InvalidToken` are consumed in this task, so later tasks don't touch
  this file again.

- [ ] **Step 1: Create the apierr package**

```go
// backend/internal/apierr/apierr.go
package apierr

import "github.com/gin-gonic/gin"

// Stable codes the frontend translates into the active locale. Keep this
// list in sync with frontend/src/locales/types.ts's ErrorCode union — no
// shared codegen for a project this size, just keep both in view when
// adding a new one.
const (
	ValidationFailed      = "validation_failed"
	InternalError         = "internal_error"
	SlugGenerationFailed  = "slug_generation_failed"
	RegistrationFailed    = "registration_failed"
	InvalidCredentials    = "invalid_credentials"
	TokenGenerationFailed = "token_generation_failed"
	Unauthorized          = "unauthorized"
	InvalidToken          = "invalid_token"
	CannotFriendSelf      = "cannot_friend_self"
	AlreadyFriends        = "already_friends"
	FriendRequestSent     = "friend_request_already_sent"
	InvalidFriendshipID   = "invalid_friendship_id"
	RequestNotFound       = "request_not_found"
	FriendshipNotFound    = "friendship_not_found"
	EntryCreateFailed     = "entry_create_failed"
	EntryUpdateFailed     = "entry_update_failed"
	EntryDeleteFailed     = "entry_delete_failed"
	EntryNotFound         = "entry_not_found"
	NoPermission          = "no_permission"
	StorageNotConfigured  = "storage_not_configured"
	StorageInitFailed     = "storage_init_failed"
	InvalidFormData       = "invalid_form_data"
	UploadFailed          = "upload_failed"
	ProfileNotFound       = "profile_not_found"
)

// JSON responds with both the stable code (for the frontend to translate)
// and a plain-English fallback (for logs, and any caller that doesn't
// bother translating — e.g. an older cached frontend build).
func JSON(c *gin.Context, status int, code string, englishMessage string) {
	c.JSON(status, gin.H{"error_code": code, "error": englishMessage})
}
```

- [ ] **Step 2: Update middleware/auth.go to use it**

```go
// backend/internal/middleware/auth.go
package middleware

import (
	"diary_app/backend/internal/apierr"
	"diary_app/backend/internal/utils"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
)

func AuthMiddleware(c *gin.Context) {
	authHeader := c.GetHeader("Authorization")
	if authHeader == "" || !strings.HasPrefix(authHeader, "Bearer ") {
		apierr.JSON(c, http.StatusUnauthorized, apierr.Unauthorized, "Unauthorized")
		c.Abort() // หยุดการทำงานทันที
		return
	}

	tokenStr := strings.TrimPrefix(authHeader, "Bearer ")
	userID, err := utils.ValidateToken(tokenStr)
	if err != nil {
		apierr.JSON(c, http.StatusUnauthorized, apierr.InvalidToken, "Invalid token")
		c.Abort()
		return
	}

	// ฝาก userID ไว้ใน Context ของ Gin
	c.Set("user_id", userID)
	c.Next()
}
```

- [ ] **Step 3: Verify it compiles**

Run: `cd backend && go build -o /tmp/main_check ./cmd/main.go`
Expected: no output, exit code 0.

- [ ] **Step 4: Commit**

```bash
git add backend/internal/apierr/apierr.go backend/internal/middleware/auth.go
git commit -m "Add apierr package with stable error codes; wire into auth middleware"
```

---

### Task 2: Backend — `auth_handler.go` error codes + `users.locale`

**Files:**
- Create: `backend/migrations/0005_add_user_locale.sql`
- Modify: `backend/internal/models/user.go`
- Modify: `backend/internal/handlers/auth_handler.go`
- Modify: `backend/cmd/main.go`

**Interfaces:**
- Consumes: `apierr.JSON`, `apierr.SlugGenerationFailed`, `apierr.RegistrationFailed`,
  `apierr.InvalidCredentials`, `apierr.TokenGenerationFailed`, `apierr.ValidationFailed`,
  `apierr.InternalError` (Task 1)
- Produces: `models.User.Locale string`; `Login` response includes `"locale"`; `GetProfile`
  response includes `locale`; new route `PUT /profile/locale` → `UpdateLocale` handler,
  reading `{"locale": "th"}` and writing just that column (no other profile fields touched).

- [ ] **Step 1: Write the migration**

```sql
-- backend/migrations/0005_add_user_locale.sql
-- UI language preference, e.g. "en" | "th". NULL means "user hasn't
-- explicitly chosen one yet" — the frontend falls back to localStorage,
-- then browser language, then English.
-- No migration runner exists in this project yet — apply manually to the
-- production DB (Supabase) when deploying this feature. Already applied to
-- the local dev Postgres container directly.

ALTER TABLE users ADD COLUMN IF NOT EXISTS locale TEXT;
```

- [ ] **Step 2: Apply it to the local dev DB**

Run: `docker exec -i diary-db psql -U postgres -d diary < backend/migrations/0005_add_user_locale.sql`
Expected: `ALTER TABLE`

- [ ] **Step 3: Add the field to the model**

```go
// backend/internal/models/user.go — add alongside the other fields, inside the existing struct:
	// UI language preference ("en", "th", ...). Empty string means "not
	// chosen yet" — the frontend decides a default.
	Locale string `json:"locale"`
```

- [ ] **Step 4: Update Login, GetProfile, UpdateProfile, and add UpdateLocale**

```go
// backend/internal/handlers/auth_handler.go — full new contents
package handlers

import (
	"diary_app/backend/internal/apierr"
	"diary_app/backend/internal/models"
	"diary_app/backend/internal/utils"
	"net/http"

	"log"

	"github.com/gin-gonic/gin"
	"golang.org/x/crypto/bcrypt"
)

// --- สมัครสมาชิก ---
func (h *EntryHandler) Register(c *gin.Context) {
	var user models.User
	if err := c.ShouldBindJSON(&user); err != nil {
		apierr.JSON(c, http.StatusBadRequest, apierr.ValidationFailed, err.Error())
		return
	}

	hashedPassword, _ := bcrypt.GenerateFromPassword([]byte(user.Password), 10)

	// birthdate is a DATE column — an empty string fails Postgres's date parser,
	// so an omitted birthdate must go in as NULL instead of "".
	var birthdate interface{}
	if user.Birthdate != "" {
		birthdate = user.Birthdate
	}

	slug, err := generateUniqueSlug(h.DB, user.FullName, user.Username)
	if err != nil {
		apierr.JSON(c, http.StatusInternalServerError, apierr.SlugGenerationFailed, "Failed to generate profile slug")
		return
	}

	query := `INSERT INTO users (
		username, password, full_name, birthdate, gender, country,
		facebook_link, gmail_link, apple_id_link, x_link, profile_picture, slug
	) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`

	_, err = h.DB.Exec(query,
		user.Username, string(hashedPassword), user.FullName, birthdate,
		user.Gender, user.Country, user.FacebookLink, user.GmailLink,
		user.AppleIDLink, user.XLink, user.ProfilePicture, slug,
	)

	if err != nil {
		apierr.JSON(c, http.StatusConflict, apierr.RegistrationFailed, "Registration failed")
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Register success"})
}

// --- เข้าสู่ระบบ ---
func (h *EntryHandler) Login(c *gin.Context) {
	var input models.User
	if err := c.ShouldBindJSON(&input); err != nil {
		log.Printf("Error binding JSON: %v", err) // ดูว่า JSON ส่งมาผิด format ไหม
		apierr.JSON(c, http.StatusBadRequest, apierr.ValidationFailed, err.Error())
		return
	}

	var dbUser models.User
	// 1. เพิ่ม username และ full_name เข้าไปใน Query
	query := "SELECT id, username, full_name, password, COALESCE(profile_picture, ''), slug, COALESCE(locale, '') FROM users WHERE username = $1"
	err := h.DB.QueryRow(query, input.Username).Scan(
		&dbUser.ID,
		&dbUser.Username,
		&dbUser.FullName,
		&dbUser.Password,
		&dbUser.ProfilePicture,
		&dbUser.Slug,
		&dbUser.Locale,
	)

	if err != nil {
		apierr.JSON(c, http.StatusUnauthorized, apierr.InvalidCredentials, "Invalid username or password")
		return
	}

	// เช็ค bcrypt ว่ารหัสผ่านที่ส่งมาตรงกับ hash ในฐานข้อมูลไหม
	if err := bcrypt.CompareHashAndPassword([]byte(dbUser.Password), []byte(input.Password)); err != nil {
		apierr.JSON(c, http.StatusUnauthorized, apierr.InvalidCredentials, "Invalid username or password")
		return
	}

	token, err := utils.GenerateToken(dbUser.ID)
	if err != nil {
		apierr.JSON(c, http.StatusInternalServerError, apierr.TokenGenerationFailed, "Could not generate token")
		return
	}

	// 2. ตอนนี้ dbUser จะมีข้อมูลครบพร้อมส่งแล้วครับ
	c.JSON(http.StatusOK, gin.H{
		"token":           token,
		"userId":          dbUser.ID,
		"username":        dbUser.Username,
		"full_name":       dbUser.FullName,
		"profile_picture": dbUser.ProfilePicture,
		"slug":            dbUser.Slug,
		"locale":          dbUser.Locale,
	})
}

// --- ดูโปรไฟล์ตัวเอง ---
func (h *EntryHandler) GetProfile(c *gin.Context) {
	userID := c.MustGet("user_id").(int)

	var u models.User
	query := `SELECT id, username, full_name,
		COALESCE(to_char(birthdate, 'YYYY-MM-DD'), ''), COALESCE(gender, ''), COALESCE(country, ''),
		COALESCE(facebook_link, ''), COALESCE(gmail_link, ''), COALESCE(apple_id_link, ''), COALESCE(x_link, ''),
		COALESCE(profile_picture, ''), slug, COALESCE(locale, '')
		FROM users WHERE id = $1`

	err := h.DB.QueryRow(query, userID).Scan(
		&u.ID, &u.Username, &u.FullName, &u.Birthdate, &u.Gender, &u.Country,
		&u.FacebookLink, &u.GmailLink, &u.AppleIDLink, &u.XLink, &u.ProfilePicture, &u.Slug, &u.Locale,
	)
	if err != nil {
		log.Printf("GetProfile error: %v", err)
		apierr.JSON(c, http.StatusInternalServerError, apierr.InternalError, "Something went wrong")
		return
	}

	c.JSON(http.StatusOK, u)
}

type UpdateProfileInput struct {
	FullName       string `json:"full_name"`
	Birthdate      string `json:"birthdate"`
	Gender         string `json:"gender"`
	Country        string `json:"country"`
	FacebookLink   string `json:"facebook_link"`
	GmailLink      string `json:"gmail_link"`
	AppleIDLink    string `json:"apple_id_link"`
	XLink          string `json:"x_link"`
	ProfilePicture string `json:"profile_picture"`
}

// --- แก้ไขโปรไฟล์ตัวเอง --- (username/password เปลี่ยนที่นี่ไม่ได้ — คนละหน้าที่)
func (h *EntryHandler) UpdateProfile(c *gin.Context) {
	userID := c.MustGet("user_id").(int)

	var input UpdateProfileInput
	if err := c.ShouldBindJSON(&input); err != nil {
		apierr.JSON(c, http.StatusBadRequest, apierr.ValidationFailed, err.Error())
		return
	}

	// birthdate is a DATE column — an empty string fails Postgres's date
	// parser, so a cleared birthdate must go in as NULL instead of "".
	var birthdate interface{}
	if input.Birthdate != "" {
		birthdate = input.Birthdate
	}

	query := `UPDATE users SET
		full_name = $1, birthdate = $2, gender = $3, country = $4,
		facebook_link = $5, gmail_link = $6, apple_id_link = $7, x_link = $8,
		profile_picture = $9
		WHERE id = $10`

	_, err := h.DB.Exec(query,
		input.FullName, birthdate, input.Gender, input.Country,
		input.FacebookLink, input.GmailLink, input.AppleIDLink, input.XLink,
		input.ProfilePicture, userID,
	)
	if err != nil {
		log.Printf("UpdateProfile error: %v", err)
		apierr.JSON(c, http.StatusInternalServerError, apierr.InternalError, "Something went wrong")
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Profile updated", "full_name": input.FullName})
}

type UpdateLocaleInput struct {
	Locale string `json:"locale" binding:"required"`
}

// --- เปลี่ยนภาษา UI --- (แยกจาก UpdateProfile เพราะ endpoint นั้นเขียนทับทุก field
// ของโปรไฟล์เสมอ — การสลับภาษาไม่ควรต้องดึงโปรไฟล์เต็มมาก่อนแล้วส่งกลับไปทั้งก้อน)
func (h *EntryHandler) UpdateLocale(c *gin.Context) {
	userID := c.MustGet("user_id").(int)

	var input UpdateLocaleInput
	if err := c.ShouldBindJSON(&input); err != nil {
		apierr.JSON(c, http.StatusBadRequest, apierr.ValidationFailed, err.Error())
		return
	}

	_, err := h.DB.Exec(`UPDATE users SET locale = $1 WHERE id = $2`, input.Locale, userID)
	if err != nil {
		log.Printf("UpdateLocale error: %v", err)
		apierr.JSON(c, http.StatusInternalServerError, apierr.InternalError, "Something went wrong")
		return
	}

	c.JSON(http.StatusOK, gin.H{"locale": input.Locale})
}
```

- [ ] **Step 5: Wire the new route**

```go
// backend/cmd/main.go — add next to the existing profile routes:
		authorized.GET("/profile", entryHandler.GetProfile)
		authorized.PUT("/profile", entryHandler.UpdateProfile)
		authorized.PUT("/profile/locale", entryHandler.UpdateLocale)
```

- [ ] **Step 6: Verify it compiles**

Run: `cd backend && go build -o /tmp/main_check ./cmd/main.go`
Expected: no output, exit code 0.

- [ ] **Step 7: Rebuild and smoke-test with curl**

Run: `docker compose build backend && docker compose up -d backend`

Forge a token for a known local user (same technique used throughout this
project's manual testing — `API_KEY` is unset locally, so the HMAC secret is
empty):

```bash
python3 -c "
import hmac, hashlib, base64, json, time
def b64url(data): return base64.urlsafe_b64encode(data).rstrip(b'=')
header = {'alg':'HS256','typ':'JWT'}
payload = {'user_id':1,'exp':int(time.time())+3600*24}
h = b64url(json.dumps(header, separators=(',',':')).encode())
p = b64url(json.dumps(payload, separators=(',',':')).encode())
sig = b64url(hmac.new(b'', h+b'.'+p, hashlib.sha256).digest())
print((h+b'.'+p+b'.'+sig).decode())
" > /tmp/token_user1.txt
TOKEN=$(cat /tmp/token_user1.txt)
curl -s -X PUT -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"locale":"th"}' http://localhost:9090/profile/locale
curl -s -H "Authorization: Bearer $TOKEN" http://localhost:9090/profile | python3 -m json.tool
```

Expected: first call returns `{"locale":"th"}`; second call's JSON includes
`"locale": "th"`.

Then reset it so later tasks' manual testing starts from a clean slate:

```bash
curl -s -X PUT -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"locale":""}' http://localhost:9090/profile/locale
```

- [ ] **Step 8: Commit**

```bash
git add backend/migrations/0005_add_user_locale.sql backend/internal/models/user.go \
  backend/internal/handlers/auth_handler.go backend/cmd/main.go
git commit -m "Add users.locale, PUT /profile/locale, and apierr codes to auth_handler"
```

---

### Task 3: Backend — `diary_handler.go` error codes

**Files:**
- Modify: `backend/internal/handlers/diary_handler.go`

**Interfaces:**
- Consumes: `apierr.JSON`, `apierr.ValidationFailed`, `apierr.InternalError`,
  `apierr.EntryCreateFailed`, `apierr.EntryUpdateFailed`, `apierr.EntryDeleteFailed`,
  `apierr.EntryNotFound`, `apierr.NoPermission`, `apierr.StorageNotConfigured`,
  `apierr.StorageInitFailed`, `apierr.InvalidFormData`, `apierr.UploadFailed` (Task 1)

- [ ] **Step 1: Add the import**

```go
// backend/internal/handlers/diary_handler.go — add to the import block:
	"diary_app/backend/internal/apierr"
```

- [ ] **Step 2: Replace every gin.H{"error": ...} call site**

```go
// GetEntries — replace:
	rows, err := h.DB.Query(query, args...)
	if err != nil {
		c.JSON(500, gin.H{"error": err.Error()})
		return
	}
// with:
	rows, err := h.DB.Query(query, args...)
	if err != nil {
		log.Printf("GetEntries query error: %v", err)
		apierr.JSON(c, 500, apierr.InternalError, "Something went wrong")
		return
	}
```

```go
// GetEntries scan error — replace:
		err := rows.Scan(&e.ID, &e.Title, &e.Content, &e.CreatedDate, &e.CreatedBy, &e.Images, &layoutStr, &e.Audience, &e.UserID, &e.CreatedByAvatar, &e.CreatedBySlug)
		if err != nil {
			c.JSON(500, gin.H{"error": "Scan error: " + err.Error()})
			return
		}
// with:
		err := rows.Scan(&e.ID, &e.Title, &e.Content, &e.CreatedDate, &e.CreatedBy, &e.Images, &layoutStr, &e.Audience, &e.UserID, &e.CreatedByAvatar, &e.CreatedBySlug)
		if err != nil {
			log.Printf("GetEntries scan error: %v", err)
			apierr.JSON(c, 500, apierr.InternalError, "Something went wrong")
			return
		}
```

```go
// CreateEntry bind error — replace:
	var input models.Entry
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(400, gin.H{"error": err.Error()})
		return
	}
// with (both in CreateEntry and UpdateEntry — same replacement in each):
	var input models.Entry
	if err := c.ShouldBindJSON(&input); err != nil {
		apierr.JSON(c, 400, apierr.ValidationFailed, err.Error())
		return
	}
```

```go
// CreateEntry insert error — replace:
	err := h.DB.QueryRow(query, input.Title, input.Content, input.CreatedBy, pq.Array(input.Images), userID, layoutParam, input.Audience, createdDateParam).
		Scan(&input.ID, &input.CreatedDate)

	if err != nil {
		c.JSON(500, gin.H{"error": "Failed to create entry: " + err.Error()})
		return
	}
// with:
	err := h.DB.QueryRow(query, input.Title, input.Content, input.CreatedBy, pq.Array(input.Images), userID, layoutParam, input.Audience, createdDateParam).
		Scan(&input.ID, &input.CreatedDate)

	if err != nil {
		log.Printf("CreateEntry error: %v", err)
		apierr.JSON(c, 500, apierr.EntryCreateFailed, "Failed to create entry")
		return
	}
```

```go
// DeleteEntry — replace:
	res, err := h.DB.Exec("DELETE FROM entries WHERE id = $1 AND user_id = $2", id, userID)
	if err != nil {
		c.JSON(500, gin.H{"error": "Failed to delete entry"})
		return
	}

	count, _ := res.RowsAffected()
	if count == 0 {
		c.JSON(403, gin.H{"error": "You don't have permission to delete this entry"})
		return
	}
// with:
	res, err := h.DB.Exec("DELETE FROM entries WHERE id = $1 AND user_id = $2", id, userID)
	if err != nil {
		log.Printf("DeleteEntry error: %v", err)
		apierr.JSON(c, 500, apierr.EntryDeleteFailed, "Failed to delete entry")
		return
	}

	count, _ := res.RowsAffected()
	if count == 0 {
		apierr.JSON(c, 403, apierr.NoPermission, "You don't have permission to delete this entry")
		return
	}
```

```go
// UpdateEntry — replace:
	res, err := h.DB.Exec(query, input.Title, input.Content, input.CreatedBy, pq.Array(input.Images), layoutParam, input.Audience, createdDateParam, id, userID)

	if err != nil {
		c.JSON(500, gin.H{"error": "Failed to update entry"})
		return
	}

	count, _ := res.RowsAffected()
	if count == 0 {
		c.JSON(403, gin.H{"error": "You don't have permission to update this entry"})
		return
	}
// with:
	res, err := h.DB.Exec(query, input.Title, input.Content, input.CreatedBy, pq.Array(input.Images), layoutParam, input.Audience, createdDateParam, id, userID)

	if err != nil {
		log.Printf("UpdateEntry error: %v", err)
		apierr.JSON(c, 500, apierr.EntryUpdateFailed, "Failed to update entry")
		return
	}

	count, _ := res.RowsAffected()
	if count == 0 {
		apierr.JSON(c, 403, apierr.NoPermission, "You don't have permission to update this entry")
		return
	}
```

```go
// GetEntry — replace:
	if err != nil {
		if err == sql.ErrNoRows {
			c.JSON(404, gin.H{"error": "Entry not found or unauthorized"})
		} else {
			c.JSON(500, gin.H{"error": err.Error()})
		}
		return
	}
// with:
	if err != nil {
		if err == sql.ErrNoRows {
			apierr.JSON(c, 404, apierr.EntryNotFound, "Entry not found or unauthorized")
		} else {
			log.Printf("GetEntry error: %v", err)
			apierr.JSON(c, 500, apierr.InternalError, "Something went wrong")
		}
		return
	}
```

```go
// UploadFiles — replace each of these four:
	if cloudinaryURL == "" {
		c.JSON(500, gin.H{"error": "Cloudinary configuration missing"})
		return
	}
// with:
	if cloudinaryURL == "" {
		apierr.JSON(c, 500, apierr.StorageNotConfigured, "Storage service is not configured")
		return
	}
```
```go
	if err != nil {
		log.Printf("Failed to init Cloudinary: %v", err)
		c.JSON(500, gin.H{"error": "Failed to initialize storage service"})
		return
	}
// with:
	if err != nil {
		log.Printf("Failed to init Cloudinary: %v", err)
		apierr.JSON(c, 500, apierr.StorageInitFailed, "Failed to initialize storage service")
		return
	}
```
```go
	if err != nil {
		c.JSON(400, gin.H{"error": "Invalid form data"})
		return
	}
// with:
	if err != nil {
		apierr.JSON(c, 400, apierr.InvalidFormData, "Invalid form data")
		return
	}
```
```go
		if err != nil {
			log.Printf("Cloudinary upload error: %v", err)
			c.JSON(500, gin.H{"error": "Upload failed"})
			return
		}
// with:
		if err != nil {
			log.Printf("Cloudinary upload error: %v", err)
			apierr.JSON(c, 500, apierr.UploadFailed, "Upload failed")
			return
		}
```

- [ ] **Step 3: Verify it compiles**

Run: `cd backend && go build -o /tmp/main_check ./cmd/main.go`
Expected: no output, exit code 0. (If `log` isn't already imported, add `"log"` to the import block — check first with `grep -n '"log"' backend/internal/handlers/diary_handler.go`, it already is.)

- [ ] **Step 4: Rebuild and smoke-test one error path**

Run: `docker compose build backend && docker compose up -d backend`

```bash
TOKEN=$(cat /tmp/token_user1.txt)
curl -s -H "Authorization: Bearer $TOKEN" http://localhost:9090/entries/999999 | python3 -m json.tool
```

Expected: `{"error_code": "entry_not_found", "error": "Entry not found or unauthorized"}`

- [ ] **Step 5: Commit**

```bash
git add backend/internal/handlers/diary_handler.go
git commit -m "Add apierr codes to diary_handler"
```

---

### Task 4: Backend — `friend_handler.go` error codes

**Files:**
- Modify: `backend/internal/handlers/friend_handler.go`

**Interfaces:**
- Consumes: `apierr.JSON`, `apierr.InternalError`, `apierr.CannotFriendSelf`,
  `apierr.AlreadyFriends`, `apierr.FriendRequestSent`, `apierr.InvalidFriendshipID`,
  `apierr.RequestNotFound`, `apierr.FriendshipNotFound`, `apierr.ValidationFailed` (Task 1)

- [ ] **Step 1: Add the import**

```go
// backend/internal/handlers/friend_handler.go — add to the import block:
	"diary_app/backend/internal/apierr"
	"log"
```

- [ ] **Step 2: Replace every gin.H{"error": ...} call site**

Every `c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})` in this
file (there are 8: in `SearchUsers`, `ListFriends` scan and query, `ListFriendRequests`
scan and query, `SendFriendRequest` ×3, `AcceptFriendRequest`, `RemoveFriendship`)
becomes:

```go
	log.Printf("<FunctionName> error: %v", err)
	apierr.JSON(c, http.StatusInternalServerError, apierr.InternalError, "Something went wrong")
	return
```

(fill in the actual function name, e.g. `SearchUsers`, `ListFriends`, etc., in each
log line so the server logs stay useful for debugging).

The remaining hardcoded ones:

```go
// SendFriendRequest bind error — replace:
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
// with:
	if err := c.ShouldBindJSON(&input); err != nil {
		apierr.JSON(c, http.StatusBadRequest, apierr.ValidationFailed, err.Error())
		return
	}
```

```go
	if input.AddresseeID == userID {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Cannot friend yourself"})
		return
	}
// with:
	if input.AddresseeID == userID {
		apierr.JSON(c, http.StatusBadRequest, apierr.CannotFriendSelf, "Cannot friend yourself")
		return
	}
```

```go
		if existingStatus == "accepted" {
			c.JSON(http.StatusConflict, gin.H{"error": "Already friends"})
			return
		}
		if existingRequesterID == userID {
			c.JSON(http.StatusConflict, gin.H{"error": "Friend request already sent"})
			return
		}
// with:
		if existingStatus == "accepted" {
			apierr.JSON(c, http.StatusConflict, apierr.AlreadyFriends, "Already friends")
			return
		}
		if existingRequesterID == userID {
			apierr.JSON(c, http.StatusConflict, apierr.FriendRequestSent, "Friend request already sent")
			return
		}
```

```go
// AcceptFriendRequest and RemoveFriendship both have:
	friendshipID, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid friendship id"})
		return
	}
// with:
	friendshipID, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		apierr.JSON(c, http.StatusBadRequest, apierr.InvalidFriendshipID, "Invalid friendship id")
		return
	}
```

```go
// AcceptFriendRequest — replace:
	if rows, _ := result.RowsAffected(); rows == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "Request not found"})
		return
	}
// with:
	if rows, _ := result.RowsAffected(); rows == 0 {
		apierr.JSON(c, http.StatusNotFound, apierr.RequestNotFound, "Request not found")
		return
	}
```

```go
// RemoveFriendship — replace:
	if rows, _ := result.RowsAffected(); rows == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "Friendship not found"})
		return
	}
// with:
	if rows, _ := result.RowsAffected(); rows == 0 {
		apierr.JSON(c, http.StatusNotFound, apierr.FriendshipNotFound, "Friendship not found")
		return
	}
```

- [ ] **Step 3: Verify it compiles**

Run: `cd backend && go build -o /tmp/main_check ./cmd/main.go`
Expected: no output, exit code 0.

- [ ] **Step 4: Rebuild and smoke-test one error path**

Run: `docker compose build backend && docker compose up -d backend`

```bash
TOKEN=$(cat /tmp/token_user1.txt)
curl -s -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"addressee_id":1}' http://localhost:9090/friends/request | python3 -m json.tool
```

Expected: `{"error_code": "cannot_friend_self", "error": "Cannot friend yourself"}`

- [ ] **Step 5: Commit**

```bash
git add backend/internal/handlers/friend_handler.go
git commit -m "Add apierr codes to friend_handler"
```

---

### Task 5: Backend — `profile_handler.go` error codes

**Files:**
- Modify: `backend/internal/handlers/profile_handler.go`

**Interfaces:**
- Consumes: `apierr.JSON`, `apierr.ProfileNotFound`, `apierr.InternalError` (Task 1)

- [ ] **Step 1: Add the import**

```go
// backend/internal/handlers/profile_handler.go — add to the import block:
	"diary_app/backend/internal/apierr"
	"log"
```

- [ ] **Step 2: Replace every gin.H{"error": ...} call site**

```go
// GetPublicProfile user lookup — replace:
	if err != nil {
		if err == sql.ErrNoRows {
			c.JSON(http.StatusNotFound, gin.H{"error": "Profile not found"})
		} else {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		}
		return
	}
// with:
	if err != nil {
		if err == sql.ErrNoRows {
			apierr.JSON(c, http.StatusNotFound, apierr.ProfileNotFound, "Profile not found")
		} else {
			log.Printf("GetPublicProfile lookup error: %v", err)
			apierr.JSON(c, http.StatusInternalServerError, apierr.InternalError, "Something went wrong")
		}
		return
	}
```

```go
// entries query error — replace:
	rows, err := h.DB.Query(
		`SELECT id, title, content, to_char(created_date, 'YYYY-MM-DD"T"HH24:MI:SS'), COALESCE(created_by, ''), images, layout, audience, user_id
		 FROM entries WHERE user_id = $1`+audienceFilter+`
		 ORDER BY id DESC`,
		p.ID,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
// with:
	rows, err := h.DB.Query(
		`SELECT id, title, content, to_char(created_date, 'YYYY-MM-DD"T"HH24:MI:SS'), COALESCE(created_by, ''), images, layout, audience, user_id
		 FROM entries WHERE user_id = $1`+audienceFilter+`
		 ORDER BY id DESC`,
		p.ID,
	)
	if err != nil {
		log.Printf("GetPublicProfile entries query error: %v", err)
		apierr.JSON(c, http.StatusInternalServerError, apierr.InternalError, "Something went wrong")
		return
	}
```

```go
// scan error — replace:
		if err := rows.Scan(&e.ID, &e.Title, &e.Content, &e.CreatedDate, &e.CreatedBy, &e.Images, &layoutStr, &e.Audience, &e.UserID); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Scan error: " + err.Error()})
			return
		}
// with:
		if err := rows.Scan(&e.ID, &e.Title, &e.Content, &e.CreatedDate, &e.CreatedBy, &e.Images, &layoutStr, &e.Audience, &e.UserID); err != nil {
			log.Printf("GetPublicProfile scan error: %v", err)
			apierr.JSON(c, http.StatusInternalServerError, apierr.InternalError, "Something went wrong")
			return
		}
```

- [ ] **Step 3: Verify it compiles**

Run: `cd backend && go build -o /tmp/main_check ./cmd/main.go`
Expected: no output, exit code 0.

- [ ] **Step 4: Rebuild and smoke-test**

Run: `docker compose build backend && docker compose up -d backend`

```bash
TOKEN=$(cat /tmp/token_user1.txt)
curl -s -H "Authorization: Bearer $TOKEN" http://localhost:9090/profile/no-such-slug-xyz | python3 -m json.tool
```

Expected: `{"error_code": "profile_not_found", "error": "Profile not found"}`

- [ ] **Step 5: Commit**

```bash
git add backend/internal/handlers/profile_handler.go
git commit -m "Add apierr codes to profile_handler"
```

---

### Task 6: Frontend — locale types and dictionaries

**Files:**
- Create: `frontend/src/locales/types.ts`
- Create: `frontend/src/locales/en.ts`
- Create: `frontend/src/locales/th.ts`
- Create: `frontend/src/locales/index.ts`

**Interfaces:**
- Produces: `Locale` (`"en" | "th"`), `SUPPORTED_LOCALES: Locale[]`, `ErrorCode` union,
  `Dictionary` interface, `TranslationKey` type, `DICTIONARIES: Record<Locale, Dictionary>`

- [ ] **Step 1: Write the shared types**

```ts
// frontend/src/locales/types.ts
export type Locale = "en" | "th"

// Keep this list in sync with backend/internal/apierr/apierr.go's constants
// — no shared codegen for a project this size, just keep both in view when
// adding a new one.
export type ErrorCode =
  | "validation_failed"
  | "internal_error"
  | "slug_generation_failed"
  | "registration_failed"
  | "invalid_credentials"
  | "token_generation_failed"
  | "unauthorized"
  | "invalid_token"
  | "cannot_friend_self"
  | "already_friends"
  | "friend_request_already_sent"
  | "invalid_friendship_id"
  | "request_not_found"
  | "friendship_not_found"
  | "entry_create_failed"
  | "entry_update_failed"
  | "entry_delete_failed"
  | "entry_not_found"
  | "no_permission"
  | "storage_not_configured"
  | "storage_init_failed"
  | "invalid_form_data"
  | "upload_failed"
  | "profile_not_found"

// Phase 1 surfaces only (header, dashboard shell, login, register). Phase 2
// adds sections here for diary-grid, diary-form, friends-explorer,
// hashtag-explorer, and the profile pages — extend this interface and both
// en.ts/th.ts together at that point.
export interface Dictionary {
  common: {
    save: string
    cancel: string
  }
  header: {
    editProfile: string
    myPublicProfile: string
    darkMode: string
    language: string
    logout: string
    navHome: string
    navHashtag: string
    navFriends: string
    guestUser: string
  }
  dashboard: {
    welcomeBefore: string
    welcomeAfter: string
    masonryLayout: string
    singleColumnLayout: string
    comingSoon: string
    newEntryTitle: string
    editMemoryTitle: string
    endOfMemories: string
    deleteEntryTitle: string
    deleteEntryDescription: string
    deleteEntryCancel: string
    deleteEntryConfirm: string
    deleteEntryDeleting: string
    deleteFailedAlert: string
    editEntryLoadFailedAlert: string
  }
  composer: {
    placeholder: string
  }
  date: {
    justNow: string
    minuteAgo: string
    minutesAgo: string
    hourAgo: string
    hoursAgo: string
    yesterday: string
    daysAgo: string
  }
  login: {
    title: string
    subtitle: string
    usernamePlaceholder: string
    passwordPlaceholder: string
    usernameRequired: string
    passwordRequired: string
    signIn: string
    loginFailed: string
    noAccount: string
    signUp: string
  }
  register: {
    titleBefore: string
    titleAfter: string
    subtitle: string
    usernameLabel: string
    fullNameLabel: string
    passwordLabel: string
    confirmPasswordLabel: string
    birthdateLabel: string
    genderLabel: string
    genderSelectPlaceholder: string
    genderMale: string
    genderFemale: string
    genderOther: string
    countryLabel: string
    countryPlaceholder: string
    socialLinksLabel: string
    facebookPlaceholder: string
    gmailPlaceholder: string
    appleIdPlaceholder: string
    xPlaceholder: string
    profilePictureOptional: string
    submitCreating: string
    submit: string
    alreadyMember: string
    signIn: string
    passwordMismatch: string
    successTitle: string
    successDescription: string
    somethingWrong: string
    imageError: string
  }
  errors: Record<ErrorCode, string>
}

// Dotted-path union of every leaf key, e.g. "header.editProfile" — used
// only for t()'s parameter type (autocomplete + typo safety at call
// sites). The dictionaries themselves are typed directly as `Dictionary`
// so a missing/misspelled key in either locale is a compile error there,
// which is the actual completeness guarantee.
type NestedKeyOf<T> = {
  [K in keyof T & string]: T[K] extends string ? K : `${K}.${NestedKeyOf<T[K]>}`
}[keyof T & string]

export type TranslationKey = NestedKeyOf<Dictionary>
```

- [ ] **Step 2: Write the English dictionary**

```ts
// frontend/src/locales/en.ts
import { Dictionary } from "./types"

const en: Dictionary = {
  common: {
    save: "Save",
    cancel: "Cancel",
  },
  header: {
    editProfile: "Edit Profile",
    myPublicProfile: "My Public Profile",
    darkMode: "Dark Mode",
    language: "Language",
    logout: "Log out",
    navHome: "Home",
    navHashtag: "Hashtag",
    navFriends: "Friends",
    guestUser: "Guest User",
  },
  dashboard: {
    welcomeBefore: "Welcome back, ",
    welcomeAfter: ". Here's your journey so far.",
    masonryLayout: "Masonry layout",
    singleColumnLayout: "Single column layout",
    comingSoon: "Coming soon",
    newEntryTitle: "New entry",
    editMemoryTitle: "✨ Edit memory",
    endOfMemories: "You've reached the end of your memories.",
    deleteEntryTitle: "Delete this entry?",
    deleteEntryDescription:
      "This entry will be permanently removed from your timeline. Are you sure you want to delete it?",
    deleteEntryCancel: "No, I changed my mind",
    deleteEntryConfirm: "Yes, delete it",
    deleteEntryDeleting: "Deleting...",
    deleteFailedAlert: "Delete failed",
    editEntryLoadFailedAlert: "Couldn't load the entry for editing.",
  },
  composer: {
    placeholder: "What's on your mind today, {name}?",
  },
  date: {
    justNow: "Just now",
    minuteAgo: "{n} minute ago",
    minutesAgo: "{n} minutes ago",
    hourAgo: "{n} hour ago",
    hoursAgo: "{n} hours ago",
    yesterday: "Yesterday",
    daysAgo: "{n} days ago",
  },
  login: {
    title: "Login",
    subtitle: "Log in to save your story",
    usernamePlaceholder: "Username",
    passwordPlaceholder: "Password",
    usernameRequired: "✕ Please enter your username",
    passwordRequired: "✕ Please enter your password",
    signIn: "Sign In",
    loginFailed: "Login failed",
    noAccount: "Don't have an account?",
    signUp: "Sign Up",
  },
  register: {
    titleBefore: "Join the ",
    titleAfter: " Community",
    subtitle: "Fill in your details to get started",
    usernameLabel: "Username *",
    fullNameLabel: "Full Name",
    passwordLabel: "Password *",
    confirmPasswordLabel: "Confirm Password *",
    birthdateLabel: "Birthdate",
    genderLabel: "Gender",
    genderSelectPlaceholder: "Select",
    genderMale: "Male",
    genderFemale: "Female",
    genderOther: "Other",
    countryLabel: "Country",
    countryPlaceholder: "Thailand",
    socialLinksLabel: "Social Media Links",
    facebookPlaceholder: "Facebook Profile URL",
    gmailPlaceholder: "Gmail Address",
    appleIdPlaceholder: "Apple ID",
    xPlaceholder: "X (Twitter) URL",
    profilePictureOptional: "Profile picture (optional)",
    submitCreating: "Creating Account...",
    submit: "Complete Registration",
    alreadyMember: "Already a member?",
    signIn: "Sign In",
    passwordMismatch: "Passwords don't match. Please check again.",
    successTitle: "Account created successfully! Redirecting you to the login page",
    successDescription: "You can log in with your new username right away",
    somethingWrong: "Something went wrong",
    imageError: "Couldn't use that image",
  },
  errors: {
    validation_failed: "Please check your input and try again.",
    internal_error: "Something went wrong. Please try again.",
    slug_generation_failed: "Failed to generate profile slug",
    registration_failed: "Registration failed",
    invalid_credentials: "Invalid username or password",
    token_generation_failed: "Could not generate token",
    unauthorized: "Unauthorized",
    invalid_token: "Invalid token",
    cannot_friend_self: "You can't add yourself as a friend",
    already_friends: "Already friends",
    friend_request_already_sent: "Friend request already sent",
    invalid_friendship_id: "Invalid friendship id",
    request_not_found: "Request not found",
    friendship_not_found: "Friendship not found",
    entry_create_failed: "Failed to create entry",
    entry_update_failed: "Failed to update entry",
    entry_delete_failed: "Failed to delete entry",
    entry_not_found: "Entry not found or unauthorized",
    no_permission: "You don't have permission to do this",
    storage_not_configured: "Storage service is not configured",
    storage_init_failed: "Failed to initialize storage service",
    invalid_form_data: "Invalid form data",
    upload_failed: "Upload failed",
    profile_not_found: "Profile not found",
  },
}

export default en
```

- [ ] **Step 3: Write the Thai dictionary**

```ts
// frontend/src/locales/th.ts
import { Dictionary } from "./types"

const th: Dictionary = {
  common: {
    save: "บันทึก",
    cancel: "ยกเลิก",
  },
  header: {
    editProfile: "แก้ไขโปรไฟล์",
    myPublicProfile: "โปรไฟล์สาธารณะของฉัน",
    darkMode: "โหมดมืด",
    language: "ภาษา",
    logout: "ออกจากระบบ",
    navHome: "หน้าแรก",
    navHashtag: "แฮชแท็ก",
    navFriends: "เพื่อน",
    guestUser: "ผู้เยี่ยมชม",
  },
  dashboard: {
    welcomeBefore: "ยินดีต้อนรับกลับมา ",
    welcomeAfter: " นี่คือเส้นทางของคุณจนถึงตอนนี้",
    masonryLayout: "เค้าโครงแบบผสม",
    singleColumnLayout: "เค้าโครงคอลัมน์เดียว",
    comingSoon: "เร็วๆ นี้",
    newEntryTitle: "บันทึกใหม่",
    editMemoryTitle: "✨ แก้ไขความทรงจำ",
    endOfMemories: "คุณมาถึงความทรงจำสุดท้ายแล้ว",
    deleteEntryTitle: "ลบบันทึกนี้ใช่ไหม?",
    deleteEntryDescription: "บันทึกนี้จะถูกลบออกจากไทม์ไลน์ของคุณอย่างถาวร คุณแน่ใจหรือไม่ว่าต้องการลบ?",
    deleteEntryCancel: "ไม่ลบ ฉันเปลี่ยนใจ",
    deleteEntryConfirm: "ใช่ ลบเลย",
    deleteEntryDeleting: "กำลังลบ...",
    deleteFailedAlert: "ลบไม่สำเร็จ",
    editEntryLoadFailedAlert: "ไม่สามารถโหลดบันทึกเพื่อแก้ไขได้",
  },
  composer: {
    placeholder: "วันนี้ {name} คิดอะไรอยู่?",
  },
  date: {
    justNow: "เมื่อสักครู่",
    minuteAgo: "{n} นาทีที่แล้ว",
    minutesAgo: "{n} นาทีที่แล้ว",
    hourAgo: "{n} ชั่วโมงที่แล้ว",
    hoursAgo: "{n} ชั่วโมงที่แล้ว",
    yesterday: "เมื่อวาน",
    daysAgo: "{n} วันที่แล้ว",
  },
  login: {
    title: "เข้าสู่ระบบ",
    subtitle: "เข้าสู่ระบบเพื่อบันทึกเรื่องราวของคุณ",
    usernamePlaceholder: "ชื่อผู้ใช้",
    passwordPlaceholder: "รหัสผ่าน",
    usernameRequired: "✕ กรุณากรอกชื่อผู้ใช้",
    passwordRequired: "✕ กรุณากรอกรหัสผ่าน",
    signIn: "เข้าสู่ระบบ",
    loginFailed: "เข้าสู่ระบบไม่สำเร็จ",
    noAccount: "ยังไม่มีบัญชี?",
    signUp: "สมัครสมาชิก",
  },
  register: {
    titleBefore: "เข้าร่วมชุมชน ",
    titleAfter: "",
    subtitle: "กรอกข้อมูลของคุณเพื่อเริ่มต้นใช้งาน",
    usernameLabel: "ชื่อผู้ใช้ *",
    fullNameLabel: "ชื่อ-นามสกุล",
    passwordLabel: "รหัสผ่าน *",
    confirmPasswordLabel: "ยืนยันรหัสผ่าน *",
    birthdateLabel: "วันเกิด",
    genderLabel: "เพศ",
    genderSelectPlaceholder: "เลือก",
    genderMale: "ชาย",
    genderFemale: "หญิง",
    genderOther: "อื่นๆ",
    countryLabel: "ประเทศ",
    countryPlaceholder: "ประเทศไทย",
    socialLinksLabel: "ลิงก์โซเชียลมีเดีย",
    facebookPlaceholder: "ลิงก์โปรไฟล์ Facebook",
    gmailPlaceholder: "อีเมล Gmail",
    appleIdPlaceholder: "Apple ID",
    xPlaceholder: "ลิงก์ X (Twitter)",
    profilePictureOptional: "รูปโปรไฟล์ (ไม่บังคับ)",
    submitCreating: "กำลังสร้างบัญชี...",
    submit: "สมัครสมาชิกให้เสร็จสมบูรณ์",
    alreadyMember: "เป็นสมาชิกอยู่แล้ว?",
    signIn: "เข้าสู่ระบบ",
    passwordMismatch: "รหัสผ่านไม่ตรงกัน กรุณาตรวจสอบอีกครั้ง",
    successTitle: "สร้างบัญชีสำเร็จ! กำลังพาไปหน้าเข้าสู่ระบบ",
    successDescription: "คุณสามารถเข้าสู่ระบบด้วยชื่อผู้ใช้ใหม่ได้ทันที",
    somethingWrong: "เกิดข้อผิดพลาดบางอย่าง",
    imageError: "ไม่สามารถใช้รูปภาพนี้ได้",
  },
  errors: {
    validation_failed: "กรุณาตรวจสอบข้อมูลที่กรอกแล้วลองใหม่อีกครั้ง",
    internal_error: "เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง",
    slug_generation_failed: "สร้างลิงก์โปรไฟล์ไม่สำเร็จ",
    registration_failed: "สมัครสมาชิกไม่สำเร็จ",
    invalid_credentials: "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง",
    token_generation_failed: "สร้างโทเคนไม่สำเร็จ",
    unauthorized: "ไม่ได้รับอนุญาต",
    invalid_token: "โทเคนไม่ถูกต้อง",
    cannot_friend_self: "คุณไม่สามารถเพิ่มตัวเองเป็นเพื่อนได้",
    already_friends: "เป็นเพื่อนกันอยู่แล้ว",
    friend_request_already_sent: "ส่งคำขอเป็นเพื่อนไปแล้ว",
    invalid_friendship_id: "รหัสความเป็นเพื่อนไม่ถูกต้อง",
    request_not_found: "ไม่พบคำขอ",
    friendship_not_found: "ไม่พบความเป็นเพื่อน",
    entry_create_failed: "สร้างบันทึกไม่สำเร็จ",
    entry_update_failed: "แก้ไขบันทึกไม่สำเร็จ",
    entry_delete_failed: "ลบบันทึกไม่สำเร็จ",
    entry_not_found: "ไม่พบบันทึกหรือไม่มีสิทธิ์เข้าถึง",
    no_permission: "คุณไม่มีสิทธิ์ทำรายการนี้",
    storage_not_configured: "ยังไม่ได้ตั้งค่าระบบจัดเก็บไฟล์",
    storage_init_failed: "เริ่มต้นระบบจัดเก็บไฟล์ไม่สำเร็จ",
    invalid_form_data: "ข้อมูลฟอร์มไม่ถูกต้อง",
    upload_failed: "อัปโหลดไม่สำเร็จ",
    profile_not_found: "ไม่พบโปรไฟล์",
  },
}

export default th
```

- [ ] **Step 4: Write the index**

```ts
// frontend/src/locales/index.ts
import en from "./en"
import th from "./th"
import { Dictionary, Locale } from "./types"

export const SUPPORTED_LOCALES: Locale[] = ["en", "th"]

export const DICTIONARIES: Record<Locale, Dictionary> = { en, th }

export * from "./types"
```

- [ ] **Step 5: Verify it type-checks**

Run: `cd frontend && npx tsc --noEmit 2>&1 | grep -i locales`
Expected: no output. (Pre-existing unrelated errors in `src/components/ui/*` from
generated shadcn components are expected and not part of this check — see
`CLAUDE.md`.)

- [ ] **Step 6: Commit**

```bash
git add frontend/src/locales/
git commit -m "Add locale types and en/th dictionaries for Phase 1 surfaces"
```

---

### Task 7: Frontend — `ApiError` + i18n helpers + service layer

**Files:**
- Create: `frontend/src/lib/api-error.ts`
- Create: `frontend/src/lib/i18n.ts`
- Modify: `frontend/src/services/api.ts`
- Modify: `frontend/src/services/auth.ts`
- Modify: `frontend/src/services/friends.ts`

**Interfaces:**
- Consumes: `Dictionary`, `TranslationKey`, `ErrorCode` (Task 6)
- Produces: `ApiError` class (`.code?: ErrorCode`), `apiError(data, fallback): ApiError`,
  `translate(dict, key, vars?): string`, `translateError(err, t): string` — `t` here is
  the function type `(key: TranslationKey, vars?: Record<string, string|number>) => string`
  that Task 8's `useLocale()` will provide.

- [ ] **Step 1: Write the ApiError class**

```ts
// frontend/src/lib/api-error.ts
import { ErrorCode } from "@/locales/types"

// Thrown by every services/*.ts function on a non-ok response. Carries the
// backend's stable error_code (when present) alongside a plain-English
// message, so call sites with access to useLocale() can translate it —
// these plain service functions can't call hooks themselves.
export class ApiError extends Error {
  code?: ErrorCode

  constructor(message: string, code?: ErrorCode) {
    super(message)
    this.name = "ApiError"
    this.code = code
  }
}

export function apiError(data: { error?: string; error_code?: string } | null | undefined, fallback: string): ApiError {
  return new ApiError(data?.error || fallback, data?.error_code as ErrorCode | undefined)
}
```

- [ ] **Step 2: Write the translation helpers**

```ts
// frontend/src/lib/i18n.ts
import { Dictionary, TranslationKey } from "@/locales/types"
import { ApiError } from "./api-error"

function getByPath(dict: Dictionary, path: string): string | undefined {
  return path.split(".").reduce<unknown>((node, segment) => {
    if (node && typeof node === "object" && segment in node) {
      return (node as Record<string, unknown>)[segment]
    }
    return undefined
  }, dict) as string | undefined
}

// Looks up `key` in `dict` and substitutes any `{name}`-style placeholders
// from `vars`. Falls back to returning the key itself if the lookup misses
// (should only happen if a locale file is out of sync — TypeScript is
// supposed to prevent that at compile time) so a broken key is visibly
// wrong rather than silently blank.
export function translate(dict: Dictionary, key: TranslationKey, vars?: Record<string, string | number>): string {
  const template = getByPath(dict, key) ?? key
  if (!vars) return template
  return Object.entries(vars).reduce((text, [name, value]) => text.replaceAll(`{${name}}`, String(value)), template)
}

export type TFunction = (key: TranslationKey, vars?: Record<string, string | number>) => string

// Translates an ApiError's code via `t`, falling back to the error's plain
// English message if the code has no entry in the active locale yet (e.g.
// a newly-added code the dictionaries haven't caught up with) or if `err`
// isn't an ApiError at all.
export function translateError(err: unknown, t: TFunction): string {
  if (err instanceof ApiError && err.code) {
    const key = `errors.${err.code}` as TranslationKey
    const translated = t(key)
    if (translated !== key) return translated
    return err.message
  }
  return err instanceof Error ? err.message : String(err)
}
```

- [ ] **Step 3: Update services/api.ts to throw ApiError**

```ts
// frontend/src/services/api.ts — add near the top, with the other imports:
import { apiError } from "@/lib/api-error";
```

```ts
// getPublicProfile — replace:
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || "Failed to load profile");
  }
// with:
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw apiError(errorData, "Failed to load profile");
  }
```

```ts
// getEntry — replace:
  if (!response.ok) throw new Error(`Failed to fetch entry: ${response.status}`);
// with:
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw apiError(errorData, `Failed to fetch entry: ${response.status}`);
  }
```

```ts
// createEntry — replace:
  if (!response.ok) throw new Error("Failed to create entry");
// with:
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw apiError(errorData, "Failed to create entry");
  }
```

```ts
// updateEntry — replace:
  if (!response.ok) throw new Error("Failed to update entry");
// with:
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw apiError(errorData, "Failed to update entry");
  }
```

```ts
// deleteEntry — replace:
  if (!response.ok) throw new Error("Failed to delete");
// with:
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw apiError(errorData, "Failed to delete");
  }
```

- [ ] **Step 4: Update services/auth.ts to throw ApiError**

```ts
// frontend/src/services/auth.ts — add near the top:
import { apiError } from "@/lib/api-error";
```

```ts
// login — replace:
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Login failed');
        }
// with:
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw apiError(errorData, 'Login failed');
        }
```

```ts
// register — replace:
  if (!response.ok) {
    const errorData = await response.json();
    // ดึง Error message ที่ส่งมาจาก Go (gin.H) มาแสดง
    throw new Error(errorData.error || 'Registration failed');
  }
// with:
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw apiError(errorData, 'Registration failed');
  }
```

```ts
// getProfile — replace:
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || 'Failed to load profile');
  }
// with:
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw apiError(errorData, 'Failed to load profile');
  }
```

```ts
// updateProfile — replace:
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || 'Failed to update profile');
  }
// with:
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw apiError(errorData, 'Failed to update profile');
  }
```

- [ ] **Step 5: Update services/friends.ts to throw ApiError**

```ts
// frontend/src/services/friends.ts — add near the top:
import { apiError } from "@/lib/api-error"
```

```ts
// authFetch — replace:
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.error || `Request failed (${res.status})`)
  }
// with:
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw apiError(data, `Request failed (${res.status})`)
  }
```

- [ ] **Step 6: Verify it type-checks**

Run: `cd frontend && npx tsc --noEmit 2>&1 | grep -Ei "api-error|i18n|services/(api|auth|friends)"`
Expected: no output.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/lib/api-error.ts frontend/src/lib/i18n.ts \
  frontend/src/services/api.ts frontend/src/services/auth.ts frontend/src/services/friends.ts
git commit -m "Throw typed ApiError from services; add translate()/translateError() helpers"
```

---

### Task 8: Frontend — `LocaleProvider` + wiring into layout and auth

**Files:**
- Create: `frontend/src/context/locale-context.tsx`
- Modify: `frontend/src/app/layout.tsx`
- Modify: `frontend/src/context/auth-context.tsx`
- Modify: `frontend/src/services/auth.ts`

**Interfaces:**
- Consumes: `DICTIONARIES`, `SUPPORTED_LOCALES`, `Locale` (Task 6); `translate` (Task 7);
  `useAuth()` (existing)
- Produces: `useLocale()` hook → `{ locale: Locale; setLocale: (l: Locale) => void; t: TFunction }`;
  `UserData.locale?: string` (auth-context.tsx); `updateLocale(locale, token)` and
  `ProfileData.locale: string` (services/auth.ts)

- [ ] **Step 1: Add `locale` to auth-context.tsx's UserData**

```ts
// frontend/src/context/auth-context.tsx — in the UserData interface, add:
  // UI language preference, synced from the account. Undefined for a
  // brand-new user who hasn't picked one yet.
  locale?: string;
```

- [ ] **Step 2: Add updateLocale() and locale to ProfileData in services/auth.ts**

```ts
// frontend/src/services/auth.ts — add `locale: string;` to the ProfileData interface,
// right after the existing `slug: string;` line.
```

```ts
// frontend/src/services/auth.ts — add this new export at the end of the file:
export const updateLocale = async (locale: string, token: string) => {
  const response = await fetch(`${API_BASE_URL}/profile/locale`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ locale }),
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw apiError(errorData, 'Failed to update language');
  }
  return response.json();
};
```

- [ ] **Step 3: Write the LocaleProvider**

```tsx
// frontend/src/context/locale-context.tsx
"use client"

import { createContext, useContext, useEffect, useMemo, useState } from "react"
import { DICTIONARIES, SUPPORTED_LOCALES, Locale } from "@/locales"
import { TranslationKey } from "@/locales/types"
import { translate } from "@/lib/i18n"
import { updateLocale } from "@/services/auth"
import { useAuth } from "./auth-context"

const STORAGE_KEY = "papymory_locale"

function isSupportedLocale(value: string | undefined | null): value is Locale {
  return !!value && (SUPPORTED_LOCALES as string[]).includes(value)
}

// Resolution order: the logged-in account's saved choice, then
// localStorage, then the browser's own language, then English.
function detectInitialLocale(accountLocale: string | undefined): Locale {
  if (isSupportedLocale(accountLocale)) return accountLocale
  if (typeof window !== "undefined") {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    if (isSupportedLocale(stored)) return stored
    const browserLang = window.navigator.language?.slice(0, 2)
    if (isSupportedLocale(browserLang)) return browserLang
  }
  return "en"
}

interface LocaleContextType {
  locale: Locale
  setLocale: (locale: Locale) => void
  t: (key: TranslationKey, vars?: Record<string, string | number>) => string
}

const LocaleContext = createContext<LocaleContextType | null>(null)

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const { token, user, updateUser } = useAuth()
  const [locale, setLocaleState] = useState<Locale>(() => detectInitialLocale(user?.locale))

  // If the account's saved locale becomes available after this provider's
  // first render (e.g. it mounts before AuthProvider finishes resolving),
  // adopt it once — but never override a choice the user already made this
  // session by clicking the switcher.
  const [adoptedAccountLocale, setAdoptedAccountLocale] = useState(false)
  useEffect(() => {
    if (!adoptedAccountLocale && isSupportedLocale(user?.locale)) {
      setLocaleState(user.locale)
      setAdoptedAccountLocale(true)
    }
  }, [user?.locale, adoptedAccountLocale])

  const setLocale = (next: Locale) => {
    setLocaleState(next)
    setAdoptedAccountLocale(true)
    if (typeof window !== "undefined") window.localStorage.setItem(STORAGE_KEY, next)
    updateUser({ locale: next })
    if (token) {
      updateLocale(next, token).catch(() => {
        /* localStorage + in-memory state already reflect the choice; a
           failed sync just means it won't follow this account to another
           device until the next successful change. */
      })
    }
  }

  const t = useMemo(() => {
    const dict = DICTIONARIES[locale]
    return (key: TranslationKey, vars?: Record<string, string | number>) => translate(dict, key, vars)
  }, [locale])

  return <LocaleContext.Provider value={{ locale, setLocale, t }}>{children}</LocaleContext.Provider>
}

export const useLocale = () => {
  const context = useContext(LocaleContext)
  if (!context) throw new Error("useLocale must be used within LocaleProvider")
  return context
}
```

- [ ] **Step 4: Wrap the app in LocaleProvider**

```tsx
// frontend/src/app/layout.tsx — replace:
import { AuthProvider } from "@/context/auth-context"
// with:
import { AuthProvider } from "@/context/auth-context"
import { LocaleProvider } from "@/context/locale-context"
```

```tsx
// frontend/src/app/layout.tsx — replace:
          <AuthProvider>
            <ThemeProvider
              attribute="data-theme"
              defaultTheme="light"
              enableSystem={false}
            >
              {children}
              <Toaster position="top-center" richColors />
            </ThemeProvider>
          </AuthProvider>
// with:
          <AuthProvider>
            <LocaleProvider>
              <ThemeProvider
                attribute="data-theme"
                defaultTheme="light"
                enableSystem={false}
              >
                {children}
                <Toaster position="top-center" richColors />
              </ThemeProvider>
            </LocaleProvider>
          </AuthProvider>
```

(`LocaleProvider` must be inside `AuthProvider` since it calls `useAuth()`.)

- [ ] **Step 5: Verify it type-checks**

Run: `cd frontend && npx tsc --noEmit 2>&1 | grep -Ei "locale-context|layout.tsx|auth-context|services/auth"`
Expected: no output.

- [ ] **Step 6: Rebuild and smoke-test in the browser**

Run: `docker compose build frontend && docker compose up -d frontend`

Open a **fresh** browser tab to `http://localhost:3000`, open devtools console, and run:

```js
JSON.parse(localStorage.getItem("user"))
```

Expected: no error thrown by the app on load (the page renders normally) — this task
adds no visible UI yet, it's pure plumbing consumed by Task 9 onward.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/context/locale-context.tsx frontend/src/app/layout.tsx \
  frontend/src/context/auth-context.tsx frontend/src/services/auth.ts
git commit -m "Add LocaleProvider/useLocale, wire into layout and auth-context"
```

---

### Task 9: Frontend — header language switcher + translated header strings

**Files:**
- Modify: `frontend/src/components/diary-header.tsx`

**Interfaces:**
- Consumes: `useLocale()` → `{ locale, setLocale, t }` (Task 8); `SUPPORTED_LOCALES` (Task 6)

- [ ] **Step 1: Add the imports**

```tsx
// frontend/src/components/diary-header.tsx — add:
import { Check } from "lucide-react"
import { useLocale } from "@/context/locale-context"
import { SUPPORTED_LOCALES } from "@/locales"

const LOCALE_LABELS: Record<string, string> = { en: "English", th: "ไทย" }
```

- [ ] **Step 2: Translate NAV_ITEMS' tooltip labels**

`NAV_ITEMS` is a module-level `const`, but its labels now need `t()`, which
only exists inside the component. Move it inside `DiaryHeader` as a `useMemo`:

```tsx
// frontend/src/components/diary-header.tsx — replace the module-level:
const NAV_ITEMS: { view: DiaryView; label: string; icon: typeof Home }[] = [
  { view: "home", label: "Home", icon: Home },
  { view: "hashtags", label: "Hashtag", icon: Hash },
  { view: "friends", label: "Friends", icon: Users },
]
// with nothing (delete it) — it moves inside the component in the next step.
```

```tsx
// frontend/src/components/diary-header.tsx — inside DiaryHeader, right after
// `const isDark = theme === "dark"`, add:
  const { locale, setLocale, t } = useLocale()
  const navItems: { view: DiaryView; label: string; icon: typeof Home }[] = [
    { view: "home", label: t("header.navHome"), icon: Home },
    { view: "hashtags", label: t("header.navHashtag"), icon: Hash },
    { view: "friends", label: t("header.navFriends"), icon: Users },
  ]
```

```tsx
// frontend/src/components/diary-header.tsx — the nav map, change:
          {NAV_ITEMS.map(({ view, label, icon: Icon }) => (
// to:
          {navItems.map(({ view, label, icon: Icon }) => (
```

- [ ] **Step 3: Translate the dropdown menu strings and add the language switcher**

```tsx
// frontend/src/components/diary-header.tsx — replace:
                  <p className="text-sm font-bold leading-none">{userName || "Guest User"}</p>
// with:
                  <p className="text-sm font-bold leading-none">{userName || t("header.guestUser")}</p>
```

```tsx
// frontend/src/components/diary-header.tsx — replace:
              <DropdownMenuItem onClick={() => router.push("/profile")} className="cursor-pointer font-medium">
                <UserCog className="mr-2 size-4" />
                <span>Edit Profile</span>
              </DropdownMenuItem>
              {userSlug && (
                <DropdownMenuItem onClick={() => router.push(`/${userSlug}`)} className="cursor-pointer font-medium">
                  <User className="mr-2 size-4" />
                  <span>My Public Profile</span>
                </DropdownMenuItem>
              )}
              <DropdownMenuCheckboxItem
                checked={isDark}
                onCheckedChange={(checked) => setTheme(checked ? "dark" : "light")}
                className="cursor-pointer font-medium"
              >
                <Moon className="mr-2 size-4" />
                <span>Dark Mode</span>
              </DropdownMenuCheckboxItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={onLogout}
                className="text-destructive focus:text-destructive cursor-pointer font-medium"
              >
                <LogOut className="mr-2 size-4" />
                <span>Log out</span>
              </DropdownMenuItem>
// with:
              <DropdownMenuItem onClick={() => router.push("/profile")} className="cursor-pointer font-medium">
                <UserCog className="mr-2 size-4" />
                <span>{t("header.editProfile")}</span>
              </DropdownMenuItem>
              {userSlug && (
                <DropdownMenuItem onClick={() => router.push(`/${userSlug}`)} className="cursor-pointer font-medium">
                  <User className="mr-2 size-4" />
                  <span>{t("header.myPublicProfile")}</span>
                </DropdownMenuItem>
              )}
              <DropdownMenuCheckboxItem
                checked={isDark}
                onCheckedChange={(checked) => setTheme(checked ? "dark" : "light")}
                className="cursor-pointer font-medium"
              >
                <Moon className="mr-2 size-4" />
                <span>{t("header.darkMode")}</span>
              </DropdownMenuCheckboxItem>
              <DropdownMenuSeparator />
              <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
                {t("header.language")}
              </DropdownMenuLabel>
              {SUPPORTED_LOCALES.map((code) => (
                <DropdownMenuItem
                  key={code}
                  onClick={() => setLocale(code)}
                  className="cursor-pointer font-medium"
                >
                  <Check className={`mr-2 size-4 ${locale === code ? "opacity-100" : "opacity-0"}`} />
                  <span>{LOCALE_LABELS[code] ?? code}</span>
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={onLogout}
                className="text-destructive focus:text-destructive cursor-pointer font-medium"
              >
                <LogOut className="mr-2 size-4" />
                <span>{t("header.logout")}</span>
              </DropdownMenuItem>
```

- [ ] **Step 4: Verify it type-checks**

Run: `cd frontend && npx tsc --noEmit 2>&1 | grep -i diary-header`
Expected: no output.

- [ ] **Step 5: Rebuild and verify in the browser**

Run: `docker compose build frontend && docker compose up -d frontend`

Open a fresh tab, log in, open the avatar dropdown. Expected: a "Language"
section listing "English" and "ไทย", with a checkmark next to the active
one. Click "ไทย" — expected: the checkmark moves, and (once Task 10+ land)
translated text starts appearing; for now just confirm no console errors and
the dropdown itself re-renders without crashing. Reload the page — expected:
"ไทย" is still checked (persisted via localStorage/account).

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/diary-header.tsx
git commit -m "Add language switcher to header dropdown; translate header/nav strings"
```

---

### Task 10: Frontend — translated dashboard shell

**Files:**
- Modify: `frontend/src/app/page.tsx`
- Modify: `frontend/src/components/new-entry-composer.tsx`
- Modify: `frontend/src/lib/entry-placeholder.ts`
- Modify: `frontend/src/components/diary-form.tsx` (one line)

**Interfaces:**
- Consumes: `useLocale()` (Task 8)

- [ ] **Step 1: Update entry-placeholder.ts to take `t`**

```ts
// frontend/src/lib/entry-placeholder.ts — full new contents
import { TFunction } from "@/lib/i18n"

// Shared with the auto-seeded text box on a brand-new entry, so both places
// invite the user with the same words.
export function getEntryPlaceholderText(t: TFunction, userName?: string) {
  return t("composer.placeholder", { name: userName ?? "" })
}
```

- [ ] **Step 2: Update its two call sites**

```tsx
// frontend/src/components/new-entry-composer.tsx — add the import:
import { useLocale } from "@/context/locale-context"
```

```tsx
// frontend/src/components/new-entry-composer.tsx — inside NewEntryComposer, add:
  const { t } = useLocale()
```

```tsx
// frontend/src/components/new-entry-composer.tsx — replace:
        {getEntryPlaceholderText(userName)}
// with:
        {getEntryPlaceholderText(t, userName)}
```

```tsx
// frontend/src/components/diary-form.tsx — add the import:
import { useLocale } from "@/context/locale-context"
```

```tsx
// frontend/src/components/diary-form.tsx — inside DiaryForm, right after the
// existing `const [loading, setLoading] = useState(false)` line, add:
  const { t } = useLocale()
```

```tsx
// frontend/src/components/diary-form.tsx — replace:
      : [createPlaceholderTextElement(getEntryPlaceholderText(userName))]
// with:
      : [createPlaceholderTextElement(getEntryPlaceholderText(t, userName))]
```

- [ ] **Step 3: Translate page.tsx's own strings**

```tsx
// frontend/src/app/page.tsx — add the import:
import { useLocale } from "@/context/locale-context"
```

```tsx
// frontend/src/app/page.tsx — inside DiaryDashboard, right after
// `const { token, handleLogout, user, isLoading } = useAuth()`, add:
  const { t } = useLocale()
```

```tsx
// frontend/src/app/page.tsx — the toggle labels, replace:
                    <ToggleGroupItem value="grid" aria-label="Masonry layout" title="Masonry layout">
                      <LayoutGrid className="size-4" />
                    </ToggleGroupItem>
                    <ToggleGroupItem value="single" aria-label="Single column layout" title="Single column layout">
                      <Rows3 className="size-4" />
                    </ToggleGroupItem>
// with:
                    <ToggleGroupItem value="grid" aria-label={t("dashboard.masonryLayout")} title={t("dashboard.masonryLayout")}>
                      <LayoutGrid className="size-4" />
                    </ToggleGroupItem>
                    <ToggleGroupItem value="single" aria-label={t("dashboard.singleColumnLayout")} title={t("dashboard.singleColumnLayout")}>
                      <Rows3 className="size-4" />
                    </ToggleGroupItem>
```

```tsx
// frontend/src/app/page.tsx — the welcome text, replace:
                  <p className="text-muted-foreground">Welcome back, <span className="text-primary font-medium">{user?.full_name}</span>. Here's your journey so far.</p>
// with:
                  <p className="text-muted-foreground">{t("dashboard.welcomeBefore")}<span className="text-primary font-medium">{user?.full_name}</span>{t("dashboard.welcomeAfter")}</p>
```

```tsx
// frontend/src/app/page.tsx — the right-lane/rail placeholder text, replace
// BOTH occurrences of the literal "Coming soon" with {t("dashboard.comingSoon")}:
                Coming soon
// with:
                {t("dashboard.comingSoon")}
```

```tsx
// frontend/src/app/page.tsx — end-of-feed message, replace:
                      <p className="text-muted-foreground text-sm font-medium italic">
                        You've reached the end of your memories.
                      </p>
// with:
                      <p className="text-muted-foreground text-sm font-medium italic">
                        {t("dashboard.endOfMemories")}
                      </p>
```

```tsx
// frontend/src/app/page.tsx — new/edit dialog title, replace:
            <DialogTitle className="text-2xl font-bold tracking-tight">
              {selectedEntry ? "✨ Edit memory" : "New entry"}
            </DialogTitle>
// with:
            <DialogTitle className="text-2xl font-bold tracking-tight">
              {selectedEntry ? t("dashboard.editMemoryTitle") : t("dashboard.newEntryTitle")}
            </DialogTitle>
```

```tsx
// frontend/src/app/page.tsx — delete confirmation dialog, replace:
            <AlertDialogTitle className="text-2xl font-bold text-foreground">Delete this entry?</AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground text-base">
              This entry will be permanently removed from your timeline. Are you sure you want to delete it?
            </AlertDialogDescription>
// with:
            <AlertDialogTitle className="text-2xl font-bold text-foreground">{t("dashboard.deleteEntryTitle")}</AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground text-base">
              {t("dashboard.deleteEntryDescription")}
            </AlertDialogDescription>
```

```tsx
// frontend/src/app/page.tsx — delete dialog buttons, replace:
            <AlertDialogCancel className="rounded-2xl border-none bg-muted hover:bg-muted/70 text-muted-foreground px-6 h-12">
              No, I changed my mind
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              disabled={isDeleting}
              className="rounded-2xl bg-destructive hover:bg-destructive/90 text-destructive-foreground px-6 h-12 shadow-lg shadow-destructive/20"
            >
              {isDeleting ? "Deleting..." : "Yes, delete it"}
            </AlertDialogAction>
// with:
            <AlertDialogCancel className="rounded-2xl border-none bg-muted hover:bg-muted/70 text-muted-foreground px-6 h-12">
              {t("dashboard.deleteEntryCancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              disabled={isDeleting}
              className="rounded-2xl bg-destructive hover:bg-destructive/90 text-destructive-foreground px-6 h-12 shadow-lg shadow-destructive/20"
            >
              {isDeleting ? t("dashboard.deleteEntryDeleting") : t("dashboard.deleteEntryConfirm")}
            </AlertDialogAction>
```

```tsx
// frontend/src/app/page.tsx — the two native alert() calls, replace:
    } catch (error) {
      alert("Delete failed");
    } finally {
// with:
    } catch (error) {
      alert(t("dashboard.deleteFailedAlert"));
    } finally {
```
```tsx
    } catch (error) {
      alert("Couldn't load the entry for editing.")
    }
// with:
    } catch (error) {
      alert(t("dashboard.editEntryLoadFailedAlert"))
    }
```

- [ ] **Step 4: Verify it type-checks**

Run: `cd frontend && npx tsc --noEmit 2>&1 | grep -Ei "page.tsx|new-entry-composer|entry-placeholder|diary-form"`
Expected: no output.

- [ ] **Step 5: Rebuild and verify in the browser**

Run: `docker compose build frontend && docker compose up -d frontend`

Open a fresh tab, log in. Switch to "ไทย" via the header dropdown (Task 9).
Expected: the welcome banner, layout toggle tooltips, "Coming soon" text, and
the composer bar's placeholder all show Thai. Click the composer to open the
New Entry dialog — expected: title reads "บันทึกใหม่". Click delete on an
entry — expected: the confirmation dialog is in Thai. Switch back to English
and confirm everything reverts.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/app/page.tsx frontend/src/components/new-entry-composer.tsx \
  frontend/src/lib/entry-placeholder.ts frontend/src/components/diary-form.tsx
git commit -m "Translate dashboard shell strings (page.tsx, composer placeholder)"
```

---

### Task 11: Frontend — locale-aware date formatting

**Files:**
- Modify: `frontend/src/lib/date-format.ts`

**Interfaces:**
- Consumes: `Dictionary`, `Locale` (Task 6)
- Produces: `formatEntryDate(dateStr, dict, locale)` — signature changes to accept the
  active dictionary and locale, since this file has no hook access of its own (same
  reasoning as `entry-placeholder.ts` in Task 10).

- [ ] **Step 1: Rewrite date-format.ts**

```ts
// frontend/src/lib/date-format.ts — full new contents
import { Dictionary, Locale } from "@/locales/types"

const INTL_LOCALE: Record<Locale, string> = { en: "en-GB", th: "th-TH" }

export const formatMonthYear = (dateStr: string | undefined, locale: Locale) => {
  if (!dateStr) return ""
  return new Date(dateStr).toLocaleDateString(INTL_LOCALE[locale], { month: "short", year: "numeric" })
}

export const monthKey = (dateStr?: string) => {
  if (!dateStr) return ""
  const d = new Date(dateStr)
  return `${d.getFullYear()}-${d.getMonth()}`
}

const formatTime = (date: Date) =>
  date.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false })

// Feed-card date label: relative wording for anything posted today ("Just
// now", "5 minutes ago", "3 hours ago" — already time-relative, so no clock
// time appended), "Yesterday" / "N days ago" for the past week and the plain
// "10 September 2026" beyond that both get the clock time appended too.
export const formatEntryDate = (dateStr: string | undefined, dict: Dictionary, locale: Locale) => {
  if (!dateStr) return ""
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()

  if (diffMs >= 0 && date.toDateString() === now.toDateString()) {
    const diffMinutes = Math.floor(diffMs / 60000)
    if (diffMinutes < 1) return dict.date.justNow
    if (diffMinutes < 60) {
      const template = diffMinutes === 1 ? dict.date.minuteAgo : dict.date.minutesAgo
      return template.replace("{n}", String(diffMinutes))
    }
    const diffHours = Math.floor(diffMinutes / 60)
    const template = diffHours === 1 ? dict.date.hourAgo : dict.date.hoursAgo
    return template.replace("{n}", String(diffHours))
  }

  // Calendar-day diff (not raw ms/24h) so e.g. 11pm-yesterday vs 1am-today
  // still count as adjacent calendar days.
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const startOfDate = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const diffDays = Math.round((startOfToday.getTime() - startOfDate.getTime()) / 86400000)

  if (diffDays === 1) return `${dict.date.yesterday}, ${formatTime(date)}`
  if (diffDays >= 2 && diffDays <= 7) return `${dict.date.daysAgo.replace("{n}", String(diffDays))}, ${formatTime(date)}`

  const absoluteDate = date.toLocaleDateString(INTL_LOCALE[locale], { day: "numeric", month: "long", year: "numeric" })
  return `${absoluteDate}, ${formatTime(date)}`
}
```

- [ ] **Step 2: Update every call site**

```bash
grep -rn "formatEntryDate(\|formatMonthYear(" frontend/src --include=*.tsx --include=*.ts
```

For each call site found (in this codebase today: `diary-grid.tsx` — two calls to
`formatEntryDate`, inside the card loop and inside the content-viewer dialog; and
`diary-timeline-sidebar.tsx` — one call to `formatMonthYear`), add `useLocale()` and
pass its `locale`/dictionary through. Since `diary-grid.tsx` and
`diary-timeline-sidebar.tsx` are Phase 2 components (not otherwise translated this
phase), this is the one deliberate exception: they need `useLocale()` purely to keep
`date-format.ts` compiling and displaying correctly in whichever language is active,
without translating the rest of those files yet.

```tsx
// frontend/src/components/diary-grid.tsx — add the import:
import { useLocale } from "@/context/locale-context"
import { DICTIONARIES } from "@/locales"
```

```tsx
// frontend/src/components/diary-grid.tsx — inside DiaryGrid, add:
  const { locale } = useLocale()
  const dict = DICTIONARIES[locale]
```

```tsx
// frontend/src/components/diary-grid.tsx — both call sites, replace:
            {formatEntryDate(entry.created_date)}
// with:
            {formatEntryDate(entry.created_date, dict, locale)}
```
```tsx
                    <span className="text-xs text-muted-foreground">
                      {formatEntryDate(viewingEntry.created_date)}
                    </span>
// with:
                    <span className="text-xs text-muted-foreground">
                      {formatEntryDate(viewingEntry.created_date, dict, locale)}
                    </span>
```

```tsx
// frontend/src/components/diary-timeline-sidebar.tsx — add the import:
import { useLocale } from "@/context/locale-context"
```

```tsx
// frontend/src/components/diary-timeline-sidebar.tsx — inside DiaryTimelineSidebar, add:
  const { locale } = useLocale()
```

```tsx
// frontend/src/components/diary-timeline-sidebar.tsx — replace:
      groups.push({ key, label: formatMonthYear(entry.created_date), anchorId: `entry-${entry.id}`, count: 1 })
// with:
      groups.push({ key, label: formatMonthYear(entry.created_date, locale), anchorId: `entry-${entry.id}`, count: 1 })
```

- [ ] **Step 3: Verify it type-checks**

Run: `cd frontend && npx tsc --noEmit 2>&1 | grep -Ei "date-format|diary-grid|diary-timeline-sidebar"`
Expected: no output.

- [ ] **Step 4: Rebuild and verify in the browser**

Run: `docker compose build frontend && docker compose up -d frontend`

Open a fresh tab, log in, switch to "ไทย". Expected: an entry older than 7 days shows
its month name in Thai (e.g. "15 มีนาคม 2026" instead of "15 March 2026"); the
left-sidebar month labels (e.g. "ก.ย. 2569") — already Thai-locale via the
hardcoded `"th-TH"` this function used before — are unaffected by locale switching
(unchanged behavior, still always Thai, since Task 11 didn't change that call site's
intent, only threaded the *new* `locale` parameter through so the function compiles;
if you want the timeline labels to also flip to English when the English locale is
active, that's a Phase 2 decision along with the rest of `diary-timeline-sidebar.tsx`'s
translation). Switch back to English — expected: the same entry now shows "15 March
2026".

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/date-format.ts frontend/src/components/diary-grid.tsx \
  frontend/src/components/diary-timeline-sidebar.tsx
git commit -m "Make date formatting locale-aware"
```

---

### Task 12: Frontend — translated login page + pre-login language switcher

**Files:**
- Create: `frontend/src/components/language-link-switcher.tsx`
- Modify: `frontend/src/app/login/page.tsx`

**Interfaces:**
- Consumes: `useLocale()` (Task 8), `translateError` (Task 7), `SUPPORTED_LOCALES` (Task 6)
- Produces: `<LanguageLinkSwitcher />` component (Task 13 reuses it)

- [ ] **Step 1: Write the shared pre-login switcher**

```tsx
// frontend/src/components/language-link-switcher.tsx
"use client"

import { useLocale } from "@/context/locale-context"
import { SUPPORTED_LOCALES } from "@/locales"
import { cn } from "@/lib/utils"

const LOCALE_LABELS: Record<string, string> = { en: "EN", th: "ไทย" }

// A lighter-weight switcher for login/register — those pages are pinned to
// a fixed light theme pre-auth (see CLAUDE.md), so this avoids pulling in
// the full dropdown-menu chrome the authenticated header uses.
export function LanguageLinkSwitcher({ className }: { className?: string }) {
  const { locale, setLocale } = useLocale()
  return (
    <div className={cn("flex items-center justify-center gap-2 text-xs font-semibold text-neutral-400", className)}>
      {SUPPORTED_LOCALES.map((code, i) => (
        <span key={code} className="flex items-center gap-2">
          {i > 0 && <span aria-hidden>·</span>}
          <button
            type="button"
            onClick={() => setLocale(code)}
            className={cn("transition-colors hover:text-logo", locale === code && "text-logo")}
          >
            {LOCALE_LABELS[code] ?? code}
          </button>
        </span>
      ))}
    </div>
  )
}
```

- [ ] **Step 2: Translate login/page.tsx**

```tsx
// frontend/src/app/login/page.tsx — add the imports:
import { useLocale } from "@/context/locale-context"
import { translateError } from "@/lib/i18n"
import { LanguageLinkSwitcher } from "@/components/language-link-switcher"
```

```tsx
// frontend/src/app/login/page.tsx — the zod schema uses static messages
// evaluated once at module load, before any locale is known. Move it inside
// the component so it can use `t()`:
```

```tsx
// frontend/src/app/login/page.tsx — replace:
const loginSchema = z.object({
  username: z.string().min(1, { message: "✕ Please enter your username" }),
  password: z.string().min(1, { message: "✕ Please enter your password" }),
})

export default function LoginPage() {
  const { handleLogin } = useAuth()
  const router = useRouter()

  const form = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      username: "",
      password: "",
    },
  })
// with:
export default function LoginPage() {
  const { handleLogin } = useAuth()
  const { t } = useLocale()
  const router = useRouter()

  const loginSchema = z.object({
    username: z.string().min(1, { message: t("login.usernameRequired") }),
    password: z.string().min(1, { message: t("login.passwordRequired") }),
  })

  const form = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      username: "",
      password: "",
    },
  })
```

(Re-declaring `loginSchema` inside the component means Zod re-validates with
the current locale's messages on every render — negligible cost at this
form's size, and it's the simplest way to get locale-reactive validation
messages without a separate i18n-aware Zod error map.)

```tsx
// frontend/src/app/login/page.tsx — replace:
      handleLogin(data.token, {
        userId: data.userId,
        username: data.username,
        full_name: data.full_name,
        profile_picture: data.profile_picture,
        slug: data.slug,
      })
      router.push("/")
    } catch (err: any) {
      toast.error(err.message || "Login failed")
    }
// with:
      handleLogin(data.token, {
        userId: data.userId,
        username: data.username,
        full_name: data.full_name,
        profile_picture: data.profile_picture,
        slug: data.slug,
        locale: data.locale,
      })
      router.push("/")
    } catch (err: any) {
      toast.error(translateError(err, t) || t("login.loginFailed"))
    }
```

```tsx
// frontend/src/app/login/page.tsx — the card copy, replace:
          <CardTitle className="text-3xl font-bold text-center text-neutral-900 tracking-tight">
            <span className="uppercase text-logo">Papymory</span> Login
          </CardTitle>
          <p className="text-center text-neutral-500 text-sm mt-2">Log in to save your story</p>
// with:
          <CardTitle className="text-3xl font-bold text-center text-neutral-900 tracking-tight">
            <span className="uppercase text-logo">Papymory</span> {t("login.title")}
          </CardTitle>
          <p className="text-center text-neutral-500 text-sm mt-2">{t("login.subtitle")}</p>
```

```tsx
// frontend/src/app/login/page.tsx — the two Input placeholders, replace:
                        placeholder="Username"
// with:
                        placeholder={t("login.usernamePlaceholder")}
```
```tsx
                        placeholder="Password"
// with:
                        placeholder={t("login.passwordPlaceholder")}
```

```tsx
// frontend/src/app/login/page.tsx — the submit button and footer link, replace:
              >
                Sign In
              </Button>

              <div className="text-sm text-neutral-500 text-center pt-2">
                Don't have an account?{' '}
                <Link
                  href="/register"
                  className="text-logo font-bold hover:underline decoration-2 underline-offset-4"
                >
                  Sign Up
                </Link>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  )
}
// with:
              >
                {t("login.signIn")}
              </Button>

              <div className="text-sm text-neutral-500 text-center pt-2">
                {t("login.noAccount")}{' '}
                <Link
                  href="/register"
                  className="text-logo font-bold hover:underline decoration-2 underline-offset-4"
                >
                  {t("login.signUp")}
                </Link>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>

      <LanguageLinkSwitcher className="mt-6" />
    </div>
  )
}
```

(The `<LanguageLinkSwitcher />` sits just outside the `<Card>`, inside the same
outer centered `<div>` — check the current file's closing tags match this
nesting before applying.)

- [ ] **Step 3: Verify it type-checks**

Run: `cd frontend && npx tsc --noEmit 2>&1 | grep -Ei "login/page|language-link-switcher"`
Expected: no output.

- [ ] **Step 4: Rebuild and verify in the browser**

Run: `docker compose build frontend && docker compose up -d frontend`

Open a fresh **incognito/private** tab (so no logged-in session/localStorage
carries over) to `http://localhost:3000/login`. Expected: "EN · ไทย" appears
below the card. Click "ไทย" — expected: title, subtitle, placeholders, and
the sign-up link all switch to Thai immediately, no reload. Submit with a
wrong password — expected: the error toast reads in Thai
("ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง"). Click "EN" — expected: everything
reverts, including the already-shown toast's *next* occurrence (toasts
already on screen won't retroactively translate, which is fine).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/language-link-switcher.tsx frontend/src/app/login/page.tsx
git commit -m "Translate login page; add pre-login language switcher"
```

---

### Task 13: Frontend — translated register page

**Files:**
- Modify: `frontend/src/app/register/page.tsx`

**Interfaces:**
- Consumes: `useLocale()` (Task 8), `translateError` (Task 7), `<LanguageLinkSwitcher />` (Task 12)

- [ ] **Step 1: Add the imports and hook**

```tsx
// frontend/src/app/register/page.tsx — add:
import { useLocale } from "@/context/locale-context"
import { translateError } from "@/lib/i18n"
import { LanguageLinkSwitcher } from "@/components/language-link-switcher"
```

```tsx
// frontend/src/app/register/page.tsx — inside RegisterPage, right after
// `const [loading, setLoading] = useState(false)`, add:
  const { t } = useLocale()
```

- [ ] **Step 2: Translate the toasts and validation message**

```tsx
// frontend/src/app/register/page.tsx — replace:
    } catch (err: any) {
      toast.error("Couldn't use that image", { description: err.message })
    }
  }
// with:
    } catch (err: any) {
      toast.error(t("register.imageError"), { description: translateError(err, t) })
    }
  }
```

```tsx
// frontend/src/app/register/page.tsx — replace:
    if (formData.password !== formData.confirmPassword) {
      toast.error("Passwords don't match. Please check again.")
      return
    }
// with:
    if (formData.password !== formData.confirmPassword) {
      toast.error(t("register.passwordMismatch"))
      return
    }
```

```tsx
// frontend/src/app/register/page.tsx — replace:
      toast.success("Account created successfully! Redirecting you to the login page", {
        description: "You can log in with your new username right away",
      })
      router.push("/login")
    } catch (err: any) {
      toast.error("Something went wrong", { description: err.message })
    } finally {
// with:
      toast.success(t("register.successTitle"), {
        description: t("register.successDescription"),
      })
      router.push("/login")
    } catch (err: any) {
      toast.error(t("register.somethingWrong"), { description: translateError(err, t) })
    } finally {
```

- [ ] **Step 3: Translate the form copy**

```tsx
// frontend/src/app/register/page.tsx — replace:
          <CardTitle className="text-3xl font-bold text-center">
            Join the <span className="uppercase text-logo">Papymory</span> Community
          </CardTitle>
          <p className="text-center text-neutral-500">Fill in your details to get started</p>
// with:
          <CardTitle className="text-3xl font-bold text-center">
            {t("register.titleBefore")}<span className="uppercase text-logo">Papymory</span>{t("register.titleAfter")}
          </CardTitle>
          <p className="text-center text-neutral-500">{t("register.subtitle")}</p>
```

```tsx
// frontend/src/app/register/page.tsx — replace:
              <p className="text-xs font-medium text-neutral-500">Profile picture (optional)</p>
// with:
              <p className="text-xs font-medium text-neutral-500">{t("register.profilePictureOptional")}</p>
```

```tsx
// frontend/src/app/register/page.tsx — replace:
                <label className="text-sm font-semibold">Username *</label>
                <Input name="username" required onChange={handleChange} className="rounded-xl bg-white!" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold">Full Name</label>
// with:
                <label className="text-sm font-semibold">{t("register.usernameLabel")}</label>
                <Input name="username" required onChange={handleChange} className="rounded-xl bg-white!" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold">{t("register.fullNameLabel")}</label>
```

```tsx
// frontend/src/app/register/page.tsx — replace:
                <label className="text-sm font-semibold">Password *</label>
                <Input name="password" type="password" required onChange={handleChange} className="rounded-xl bg-white!" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold">Confirm Password *</label>
// with:
                <label className="text-sm font-semibold">{t("register.passwordLabel")}</label>
                <Input name="password" type="password" required onChange={handleChange} className="rounded-xl bg-white!" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold">{t("register.confirmPasswordLabel")}</label>
```

```tsx
// frontend/src/app/register/page.tsx — replace:
                <label className="text-sm font-semibold">Birthdate</label>
                <Input name="birthdate" type="date" onChange={handleChange} className="rounded-xl bg-white!" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold">Gender</label>
                <Select onValueChange={(v) => setFormData({...formData, gender: v})}>
                  <SelectTrigger className="rounded-xl bg-white!"><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent className="bg-white! text-neutral-900">
                    <SelectItem value="male" className="focus:bg-neutral-100! focus:text-neutral-900!">Male</SelectItem>
                    <SelectItem value="female" className="focus:bg-neutral-100! focus:text-neutral-900!">Female</SelectItem>
                    <SelectItem value="other" className="focus:bg-neutral-100! focus:text-neutral-900!">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold">Country</label>
                <Input name="country" placeholder="Thailand" onChange={handleChange} className="rounded-xl bg-white!" />
              </div>
// with:
                <label className="text-sm font-semibold">{t("register.birthdateLabel")}</label>
                <Input name="birthdate" type="date" onChange={handleChange} className="rounded-xl bg-white!" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold">{t("register.genderLabel")}</label>
                <Select onValueChange={(v) => setFormData({...formData, gender: v})}>
                  <SelectTrigger className="rounded-xl bg-white!"><SelectValue placeholder={t("register.genderSelectPlaceholder")} /></SelectTrigger>
                  <SelectContent className="bg-white! text-neutral-900">
                    <SelectItem value="male" className="focus:bg-neutral-100! focus:text-neutral-900!">{t("register.genderMale")}</SelectItem>
                    <SelectItem value="female" className="focus:bg-neutral-100! focus:text-neutral-900!">{t("register.genderFemale")}</SelectItem>
                    <SelectItem value="other" className="focus:bg-neutral-100! focus:text-neutral-900!">{t("register.genderOther")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold">{t("register.countryLabel")}</label>
                <Input name="country" placeholder={t("register.countryPlaceholder")} onChange={handleChange} className="rounded-xl bg-white!" />
              </div>
```

```tsx
// frontend/src/app/register/page.tsx — replace:
              <label className="text-sm font-bold text-neutral-500">Social Media Links</label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Input name="facebook_link" placeholder="Facebook Profile URL" onChange={handleChange} className="rounded-xl bg-blue-50!" />
                <Input name="gmail_link" placeholder="Gmail Address" onChange={handleChange} className="rounded-xl bg-red-50!" />
                <Input name="apple_id_link" placeholder="Apple ID" onChange={handleChange} className="rounded-xl bg-gray-50!" />
                <Input name="x_link" placeholder="X (Twitter) URL" onChange={handleChange} className="rounded-xl bg-slate-50!" />
              </div>
// with:
              <label className="text-sm font-bold text-neutral-500">{t("register.socialLinksLabel")}</label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Input name="facebook_link" placeholder={t("register.facebookPlaceholder")} onChange={handleChange} className="rounded-xl bg-blue-50!" />
                <Input name="gmail_link" placeholder={t("register.gmailPlaceholder")} onChange={handleChange} className="rounded-xl bg-red-50!" />
                <Input name="apple_id_link" placeholder={t("register.appleIdPlaceholder")} onChange={handleChange} className="rounded-xl bg-gray-50!" />
                <Input name="x_link" placeholder={t("register.xPlaceholder")} onChange={handleChange} className="rounded-xl bg-slate-50!" />
              </div>
```

```tsx
// frontend/src/app/register/page.tsx — replace:
              {loading ? "Creating Account..." : "Complete Registration"}
            </Button>
          </form>
        </CardContent>

        <CardFooter className="justify-center p-6 border-t border-neutral-200 bg-white!">
          <p className="text-sm">Already a member? <Link href="/login" className="text-logo font-bold hover:underline">Sign In</Link></p>
        </CardFooter>
      </Card>
    </div>
  )
}
// with:
              {loading ? t("register.submitCreating") : t("register.submit")}
            </Button>
          </form>
        </CardContent>

        <CardFooter className="justify-center p-6 border-t border-neutral-200 bg-white!">
          <p className="text-sm">{t("register.alreadyMember")} <Link href="/login" className="text-logo font-bold hover:underline">{t("register.signIn")}</Link></p>
        </CardFooter>
      </Card>

      <LanguageLinkSwitcher className="mt-6" />
    </div>
  )
}
```

- [ ] **Step 4: Verify it type-checks**

Run: `cd frontend && npx tsc --noEmit 2>&1 | grep -i "register/page"`
Expected: no output.

- [ ] **Step 5: Rebuild and verify in the browser**

Run: `docker compose build frontend && docker compose up -d frontend`

Open a fresh incognito tab to `http://localhost:3000/register`. Click "ไทย".
Expected: every label, placeholder, dropdown option, and button text is in
Thai; "EN · ไทย" itself is present below the card. Submit with mismatched
passwords — expected: the Thai mismatch toast. Fix and submit — expected:
the Thai success toast, then redirect to `/login` (which should now also
default to Thai, since the choice was persisted to `localStorage` — verify
this).

- [ ] **Step 6: Commit**

```bash
git add frontend/src/app/register/page.tsx
git commit -m "Translate register page"
```

---

## Self-Review Notes

- **Spec coverage:** Architecture overview (Task 8), translation content/library
  choice (Tasks 6–7), backend persistence & error codes (Tasks 1–5), scope of what's
  translated (Tasks 9–13, explicitly excluding diary-grid/diary-form/friends/hashtags
  per the Global Constraints), rollout phasing (this whole plan is Phase 1) — all
  covered. The spec's login/register pre-login switcher gap (caught during the
  spec's own self-review) is covered by Task 12/13's `LanguageLinkSwitcher`.
- **Deviations from the spec's literal wording, made explicit above rather than
  silently:** (1) translation happens at UI call sites via `translateError(err, t)`,
  not inside the plain `services/*.ts` functions, since those can't call React hooks
  — services only attach the stable `.code` via `ApiError`. (2) Locale persistence
  uses a new dedicated `PUT /profile/locale` endpoint rather than the existing
  `PUT /profile`, because that handler overwrites every profile column
  unconditionally and would otherwise require a fetch-then-resend round trip just to
  flip a language toggle.
- **Type consistency check:** `Dictionary` (Task 6) → consumed identically by `en.ts`/
  `th.ts` (Task 6), `translate()`/`i18n.ts` (Task 7), `LocaleProvider` (Task 8), and
  every UI task's `t()` calls. `ApiError.code: ErrorCode` (Task 7) → `translateError()`
  (Task 7) → every `catch` block in Tasks 12–13. `TFunction` (Task 7) →
  `getEntryPlaceholderText(t, ...)` (Task 10) and `useLocale()`'s return type (Task 8)
  match. `formatEntryDate(dateStr, dict, locale)`/`formatMonthYear(dateStr, locale)`
  (Task 11) signatures match their call sites in the same task.
