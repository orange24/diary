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
	// Who can see this entry — "private" | "friend" | "public". Storage
	// only for now: no query anywhere yet fetches another user's entries,
	// so this doesn't gate visibility until a friends/public feed exists.
	Audience string `json:"audience"`
}
