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
	// The entry's owner — lets the frontend tell its own entries apart from
	// a friend's entry merged into the same feed (e.g. to style/gate them).
	UserID int `json:"user_id"`
	// The author's profile picture (only populated by GetEntries), shown
	// next to their name in the feed card's hover overlay.
	CreatedByAvatar string `json:"created_by_avatar,omitempty"`
	// The author's profile slug (only populated by GetEntries), used to
	// link the feed card's author name to their public profile page.
	CreatedBySlug string `json:"created_by_slug,omitempty"`
	// Which of the author's friend_groups this entry is scoped to — empty
	// means "all friends" (any tagged friend can see it). Bound on
	// create/update, and only ever read back by GetEntry (for the author's
	// own edit flow) and Create/UpdateEntry's response; never exposed to
	// other viewers, since a group is private to its owner.
	FriendGroupIDs []int `json:"friend_group_ids,omitempty"`
}
