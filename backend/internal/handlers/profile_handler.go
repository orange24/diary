package handlers

import (
	"database/sql"
	"diary_app/backend/internal/apierr"
	"diary_app/backend/internal/models"
	"encoding/json"
	"log"
	"net/http"
	"regexp"

	"github.com/gin-gonic/gin"
)

type PublicProfile struct {
	ID             int    `json:"id"`
	Username       string `json:"username"`
	FullName       string `json:"full_name"`
	ProfilePicture string `json:"profile_picture"`
	FacebookLink   string `json:"facebook_link"`
	GmailLink      string `json:"gmail_link"`
	AppleIDLink    string `json:"apple_id_link"`
	XLink          string `json:"x_link"`
	Slug           string `json:"slug"`
	IsSelf         bool   `json:"is_self"`
	IsFriend       bool   `json:"is_friend"`
}

type PublicProfileResponse struct {
	Profile PublicProfile  `json:"profile"`
	Entries []models.Entry `json:"entries"`
}

// GET /profile/:slug — a user's public-facing profile page: their info plus
// whichever of their entries the requester is allowed to see. Viewing your
// own slug returns everything. Anyone else — even an accepted friend —
// only sees entries where they're specifically @-tagged (by username or an
// approved Contact handle), the same auto-visibility rule GetEntries uses
// to merge a friend's tagged entries into your own feed; every entry is
// otherwise private to its owner.
func (h *EntryHandler) GetPublicProfile(c *gin.Context) {
	requesterID := c.MustGet("user_id").(int)
	slug := c.Param("slug")

	var p PublicProfile
	err := h.DB.QueryRow(
		`SELECT id, username, COALESCE(full_name, ''), COALESCE(profile_picture, ''),
		        COALESCE(facebook_link, ''), COALESCE(gmail_link, ''), COALESCE(apple_id_link, ''), COALESCE(x_link, ''),
		        slug
		 FROM users WHERE slug = $1`,
		slug,
	).Scan(&p.ID, &p.Username, &p.FullName, &p.ProfilePicture, &p.FacebookLink, &p.GmailLink, &p.AppleIDLink, &p.XLink, &p.Slug)
	if err != nil {
		if err == sql.ErrNoRows {
			apierr.JSON(c, http.StatusNotFound, apierr.ProfileNotFound, "Profile not found")
		} else {
			log.Printf("GetPublicProfile lookup error: %v", err)
			apierr.JSON(c, http.StatusInternalServerError, apierr.InternalError, "Something went wrong")
		}
		return
	}

	p.IsSelf = p.ID == requesterID
	if !p.IsSelf {
		_ = h.DB.QueryRow(
			`SELECT EXISTS(
			   SELECT 1 FROM friendships
			   WHERE status = 'accepted'
			     AND ((requester_id = $1 AND addressee_id = $2) OR (requester_id = $2 AND addressee_id = $1))
			 )`,
			requesterID, p.ID,
		).Scan(&p.IsFriend)
	}

	// A friend only sees entries where they're specifically tagged, also
	// honoring the author's friend-group scoping: no entry_friend_groups
	// rows at all means "all friends" (unrestricted); otherwise the
	// requester must belong to at least one referenced group.
	groupCheck := `(
		NOT EXISTS (SELECT 1 FROM entry_friend_groups efg WHERE efg.entry_id = entries.id)
		OR EXISTS (
		  SELECT 1 FROM entry_friend_groups efg
		  JOIN friend_group_members fgm ON fgm.group_id = efg.group_id
		  WHERE efg.entry_id = entries.id AND fgm.friend_user_id = $2
		)
	)`

	// A stranger (not the owner, not a friend) never sees any entries —
	// skip the query entirely rather than add a query condition that could
	// never match.
	var entries []models.Entry = []models.Entry{}
	if p.IsSelf || p.IsFriend {
		var entryFilter string
		args := []interface{}{p.ID}
		if p.IsSelf {
			entryFilter = "" // owner sees everything
		} else {
			var requesterUsername string
			_ = h.DB.QueryRow("SELECT username FROM users WHERE id = $1", requesterID).Scan(&requesterUsername)

			mentionClause := `EXISTS (
				SELECT 1 FROM contacts ct
				WHERE ct.owner_id = entries.user_id
				  AND ct.linked_user_id = $2
				  AND ct.link_status = 'accepted'
				  AND entries.layout::text ~ ('@' || ct.handle || '\y')
			  )`
			args = append(args, requesterID)
			if requesterUsername != "" {
				mentionClause = "(entries.layout::text ~ $3 OR " + mentionClause + ")"
				args = append(args, "@"+regexp.QuoteMeta(requesterUsername)+`\y`)
			} else {
				mentionClause = "(" + mentionClause + ")"
			}

			entryFilter = " AND " + mentionClause + " AND " + groupCheck
		}

		rows, err := h.DB.Query(
			`SELECT id, title, content, to_char(created_date, 'YYYY-MM-DD"T"HH24:MI:SS'), COALESCE(created_by, ''), images, layout, user_id
			 FROM entries WHERE user_id = $1`+entryFilter+`
			 ORDER BY id DESC`,
			args...,
		)
		if err != nil {
			log.Printf("GetPublicProfile entries query error: %v", err)
			apierr.JSON(c, http.StatusInternalServerError, apierr.InternalError, "Something went wrong")
			return
		}
		defer rows.Close()

		for rows.Next() {
			var e models.Entry
			var layoutStr sql.NullString
			if err := rows.Scan(&e.ID, &e.Title, &e.Content, &e.CreatedDate, &e.CreatedBy, &e.Images, &layoutStr, &e.UserID); err != nil {
				log.Printf("GetPublicProfile scan error: %v", err)
				apierr.JSON(c, http.StatusInternalServerError, apierr.InternalError, "Something went wrong")
				return
			}
			if layoutStr.Valid {
				e.Layout = json.RawMessage(layoutStr.String)
			}
			entries = append(entries, e)
		}
	}

	c.JSON(http.StatusOK, PublicProfileResponse{Profile: p, Entries: entries})
}
