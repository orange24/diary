# Multi-Language (i18n) Support — Design

## Goal

Let users switch the app's UI language (initially Thai and English, designed to
add more later) without changing the app's URL structure or bringing in a
heavyweight i18n framework the app doesn't need at this scale.

## Non-Goals

- Translating user-generated content (diary entries, hashtags, display names,
  usernames). That's real user data and stays exactly as typed.
- URL-based locale routing (`/en/...`, `/th/...`). The app's `/[slug]` public
  profile route already claims the top-level dynamic segment
  (`papymory.com/watchara2`); prefixing every route with a locale segment
  would break that clean-URL scheme for no benefit this app needs (it isn't
  optimizing for locale-specific SEO).
- Full ICU pluralization / RTL support. Not needed for the languages in scope;
  the design doesn't block adding it later if that changes.
- Translating source code comments — not user-facing.

## Architecture Overview

A `LocaleProvider` React context wraps the app the same way `AuthProvider`
(`src/context/auth-context.tsx`) and `next-themes` already do, exposing:

```ts
interface LocaleContextType {
  locale: Locale                              // "en" | "th" | ...
  setLocale: (locale: Locale) => void
  t: (key: TranslationKey, vars?: Record<string, string | number>) => string
}
```

No routing changes. `setLocale` updates React state immediately (so the UI
re-renders in the new language right away), writes the choice to
`localStorage`, and — if the user is logged in — persists it to their account
via `PUT /profile` so the choice follows them across devices/browsers.

`LocaleProvider` wraps the whole app in the root layout (`app/layout.tsx`),
not just the authenticated dashboard, since `login`/`register` render before
any account exists. Those two pages get a small text-link switcher (e.g. "EN
· ไทย") in a corner of their card — same `useTranslation()`/`setLocale`
plumbing as the header dropdown, just a lighter-weight control to match their
existing fixed-light, pre-auth design. Without this, a first-time visitor
would have no manual way to pick a language before registering, only
browser auto-detection.

### Locale resolution order (on app load)

1. Logged-in user's saved `locale` on their account (from `GET /profile`)
2. `localStorage` (`papymory_locale`)
3. Browser's `navigator.language`, mapped to the nearest supported locale
4. Fallback: `"en"`

## Translation Content & Library Choice

**Decision: no i18n library.** `next-intl` is built around the routing
integration this design explicitly rules out; `react-i18next` brings
namespace/backend/suspense machinery this app's ~2-4-locale scale doesn't
need. Instead:

- `frontend/src/locales/en.ts` — the source-of-truth dictionary, a flat nested
  object of translation keys to English strings, grouped by feature area:

  ```ts
  const en = {
    common: { save: "Save", cancel: "Cancel", loading: "Loading..." },
    header: { editProfile: "Edit Profile", myPublicProfile: "My Public Profile", darkMode: "Dark Mode", logout: "Log out" },
    composer: { placeholder: "What's on your mind today, {name}?" },
    audience: { private: "Only me", friend: "Friends", public: "Public" },
    date: { justNow: "Just now", minutesAgo: "{n} minute{s} ago", hoursAgo: "{n} hour{s} ago", yesterday: "Yesterday", daysAgo: "{n} days ago" },
    errors: { invalid_credentials: "Invalid username or password", username_taken: "That username is already taken", /* ...one entry per backend error_code... */ internal_error: "Something went wrong. Please try again." },
    // ...one section per feature area, populated during Phase 1/2 implementation
  } as const
  export default en
  export type TranslationKey = NestedKeyOf<typeof en>  // dotted-path union, e.g. "header.editProfile"
  ```

- `frontend/src/locales/th.ts` (and future locale files) implement
  `Record<TranslationKey, string>` — TypeScript raises a compile error if a
  key from `en.ts` is missing, so locales can't silently drift out of sync.
- `frontend/src/lib/i18n.ts` exports the `useTranslation()` hook (reads
  `LocaleContext`) and the `t()` implementation: dictionary lookup by dotted
  key path, then a `{name}`-style `String.replace` interpolation pass. No
  pluralization engine — the handful of count-dependent strings (e.g. "N
  minutes ago") pass an already-pluralized value in, same as today.

Migrating to a full library later is a mechanical follow-up if ever needed,
since call sites (`t(key, vars)`) keep the same shape.

## Backend Persistence & Error Codes

### Locale column

New migration `backend/migrations/0005_add_user_locale.sql`:

```sql
ALTER TABLE users ADD COLUMN IF NOT EXISTS locale TEXT;
```

Nullable — `NULL` means "user hasn't explicitly chosen one," so the frontend
falls through to `localStorage`/browser detection. `GetProfile` returns it
(`COALESCE(locale, '')` like other optional profile fields);
`UpdateProfileInput`/`ProfileUpdate` gain a `locale` field so the existing
`PUT /profile` endpoint (no new endpoint needed) can set it.

### Error codes

New `backend/internal/apierr` package:

```go
package apierr

const (
    InvalidCredentials   = "invalid_credentials"
    UsernameTaken        = "username_taken"
    CannotFriendSelf     = "cannot_friend_self"
    AlreadyFriends       = "already_friends"
    FriendRequestSent    = "friend_request_already_sent"
    ProfileNotFound      = "profile_not_found"
    FriendshipNotFound   = "friendship_not_found"
    RequestNotFound      = "request_not_found"
    InvalidFriendshipID  = "invalid_friendship_id"
    Unauthorized         = "unauthorized"
    InvalidToken         = "invalid_token"
    ValidationFailed     = "validation_failed"   // ShouldBindJSON failures
    NoPermission         = "no_permission"       // edit/delete another user's entry
    InternalError        = "internal_error"      // catch-all for raw err.Error() cases
)

// JSON responds with both the stable code (for the frontend to translate)
// and a plain-English fallback (for logs, and any caller that doesn't
// bother translating).
func JSON(c *gin.Context, status int, code string, englishMessage string) {
    c.JSON(status, gin.H{"error_code": code, "error": englishMessage})
}
```

Every handler's `gin.H{"error": "..."}` call site (~30 across
`diary_handler.go`, `auth_handler.go`, `friend_handler.go`,
`profile_handler.go`, `middleware/auth.go`) is replaced with
`apierr.JSON(c, status, apierr.SomeCode, "English fallback text")`.

Raw `err.Error()` passthroughs (DB/driver errors — currently sent straight to
the client, which is also an information-leak) become:

```go
log.Printf("internal error: %v", err)
apierr.JSON(c, http.StatusInternalServerError, apierr.InternalError, "Something went wrong")
```

### Frontend consumption

`services/api.ts`, `services/auth.ts`, `services/friends.ts` already funnel
error responses through small helpers that do
`throw new Error(errorData.error || fallback)`. These change to prefer
`errorData.error_code`:

```ts
const data = await res.json().catch(() => ({}))
const message = data.error_code ? t(`errors.${data.error_code}`) : (data.error || fallback)
throw new Error(message)
```

If `error_code` is present but not found in the current locale's dictionary
(a code the frontend doesn't know about yet, or an older cached bundle), it
falls back to the plain English `error` string rather than throwing on a
missing key — graceful degradation, never a broken toast.

## Scope of What Gets Translated

- All static UI chrome across every component: buttons, labels, headings,
  toasts, placeholders, empty states, nav items, dropdown menu items, dialog
  copy, form labels.
- Relative/absolute date formatting in `lib/date-format.ts`
  (`formatEntryDate`, `formatMonthYear`) becomes locale-aware, keyed off the
  same `locale` value — there's already `th-TH`/`en-GB` precedent there via
  `toLocaleDateString`.
- Backend error messages, via the error-code mechanism above.
- **Not translated:** diary entry content, hashtags, usernames, display
  names, profile bios/social links — user data, untouched. Source code
  comments — not user-facing, untouched.

## Rollout Phasing

**Phase 1 (infra + highest-traffic surfaces):**
- `LocaleProvider`, `en.ts`/`th.ts` dictionaries (covering Phase 1's surfaces
  only), `useTranslation()` hook
- Backend: `0005_add_user_locale.sql` migration, `apierr` package, all
  handler call sites updated
- Language switcher in the avatar dropdown menu (`diary-header.tsx`), next to
  the existing Dark Mode toggle, plus the small pre-login text-link switcher
  on `login`/`register`
- Translated: header/nav, main dashboard (`page.tsx`), login, register,
  toasts for auth/entry-CRUD flows

**Phase 2 (remaining surfaces):**
- Friends explorer, hashtag explorer, profile/edit-profile pages, public
  profile page, diary form (scrapbook editor toolbar, sticker picker, entry
  composer), remaining toasts and empty states

Phase 1 alone is a shippable, testable milestone — the language switcher
works and the most-used screens are translated — rather than one large
all-or-nothing change.

## Testing

- Manual verification (per this project's established pattern — no test
  runner configured): switch languages via the dropdown and confirm text
  updates immediately without a page reload; log out and back in and confirm
  the account's saved locale wins over a stale `localStorage` value; trigger
  a translated error (e.g. wrong password) and confirm the toast shows in the
  active locale; confirm an unrecognized `error_code` still shows the English
  fallback instead of breaking.
- TypeScript compilation is the primary safety net for dictionary
  completeness — a locale file missing a key fails `tsc`, not silently at
  runtime.
