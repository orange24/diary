package models

import (
	"encoding/json"

	"github.com/lib/pq"
)

type Entry struct {
	ID          int             `json:"id"`
	Title       string          `json:"title"`
	Content     string          `json:"content"`
	CreatedDate string          `json:"created_date"`
	CreatedBy   string          `json:"created_by"`
	Images      pq.StringArray  `json:"images"`
	Layout      json.RawMessage `json:"layout,omitempty"`
	// Who can see this entry — "private" | "friend" | "public".
	Audience string `json:"audience"`
	// The entry's owner — lets the frontend tell its own entries apart from
	// a friend's entry merged into the same feed (e.g. to style/gate them).
	UserID int `json:"user_id"`
}
