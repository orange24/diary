package handlers

import (
	"database/sql"
	"fmt"
	"regexp"
	"strings"
)

var slugNonAlnumPattern = regexp.MustCompile(`[^a-z0-9]+`)

// Path segments already claimed by real app routes — a generated slug must
// never collide with one of these or it would be unreachable.
var reservedSlugs = map[string]bool{
	"login": true, "register": true, "profile": true,
	"api": true, "entries": true, "friends": true, "users": true,
	"upload": true, "uploads": true, "static": true, "": true,
}

func slugify(s string) string {
	s = strings.ToLower(strings.TrimSpace(s))
	s = slugNonAlnumPattern.ReplaceAllString(s, "-")
	return strings.Trim(s, "-")
}

// generateUniqueSlug derives a URL slug from the user's display name
// (falling back to their username), appending a numeric suffix on
// collision with an existing slug or a reserved app route — e.g.
// "watchara", "watchara2", "watchara3".
func generateUniqueSlug(db *sql.DB, fullName, username string) (string, error) {
	base := slugify(fullName)
	if base == "" {
		base = slugify(username)
	}
	if base == "" {
		base = "user"
	}

	candidate := base
	suffix := 1
	for {
		if !reservedSlugs[candidate] {
			var exists bool
			if err := db.QueryRow(`SELECT EXISTS(SELECT 1 FROM users WHERE slug = $1)`, candidate).Scan(&exists); err != nil {
				return "", err
			}
			if !exists {
				return candidate, nil
			}
		}
		suffix++
		candidate = fmt.Sprintf("%s%d", base, suffix)
	}
}
