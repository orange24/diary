package handlers

import (
	"database/sql"
	"diary_app/backend/internal/models"
	"encoding/json"
	"net/http"

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
// own slug returns everything; anyone else sees "public" entries always,
// and "friend" entries only once they're an accepted friend of that user —
// "private" entries never leave the owner's own feed.
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
			c.JSON(http.StatusNotFound, gin.H{"error": "Profile not found"})
		} else {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
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

	var audienceFilter string
	switch {
	case p.IsSelf:
		audienceFilter = "" // owner sees everything, including private
	case p.IsFriend:
		audienceFilter = " AND audience IN ('public', 'friend')"
	default:
		audienceFilter = " AND audience = 'public'"
	}

	rows, err := h.DB.Query(
		`SELECT id, title, content, created_date, COALESCE(created_by, ''), images, layout, audience, user_id
		 FROM entries WHERE user_id = $1`+audienceFilter+`
		 ORDER BY id DESC`,
		p.ID,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer rows.Close()

	entries := []models.Entry{}
	for rows.Next() {
		var e models.Entry
		var layoutStr sql.NullString
		if err := rows.Scan(&e.ID, &e.Title, &e.Content, &e.CreatedDate, &e.CreatedBy, &e.Images, &layoutStr, &e.Audience, &e.UserID); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Scan error: " + err.Error()})
			return
		}
		if layoutStr.Valid {
			e.Layout = json.RawMessage(layoutStr.String)
		}
		entries = append(entries, e)
	}

	c.JSON(http.StatusOK, PublicProfileResponse{Profile: p, Entries: entries})
}
