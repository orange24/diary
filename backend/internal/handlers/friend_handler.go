package handlers

import (
	"database/sql"
	"log"
	"net/http"
	"strconv"
	"strings"
	"time"

	"diary_app/backend/internal/apierr"
	"github.com/gin-gonic/gin"
)

type FriendUser struct {
	ID             int    `json:"id"`
	Username       string `json:"username"`
	FullName       string `json:"full_name"`
	ProfilePicture string `json:"profile_picture"`
}

// "incoming" (someone sent it to us, waiting on our accept/decline) |
// "outgoing" (we sent it, waiting on the other person)
type FriendRequestItem struct {
	ID        int        `json:"id"`
	Direction string     `json:"direction"`
	User      FriendUser `json:"user"`
}

type FriendListItem struct {
	FriendshipID int `json:"friendship_id"`
	FriendUser
}

// "none" | "friends" | "outgoing" (we sent it) | "incoming" (they sent it)
type UserSearchResult struct {
	FriendUser
	Relationship string `json:"relationship"`
	FriendshipID *int   `json:"friendship_id,omitempty"`
}

// GET /users/search?q=... — find people to add, tagging along each result's
// current relationship so the frontend can render the right button state.
func (h *EntryHandler) SearchUsers(c *gin.Context) {
	userID := c.MustGet("user_id").(int)
	q := strings.TrimSpace(c.Query("q"))
	if q == "" {
		c.JSON(http.StatusOK, []UserSearchResult{})
		return
	}
	like := "%" + q + "%"

	query := `
		SELECT u.id, u.username, COALESCE(u.full_name, ''), COALESCE(u.profile_picture, ''), f.id, f.status, f.requester_id
		FROM users u
		LEFT JOIN friendships f
			ON (f.requester_id = u.id AND f.addressee_id = $1)
			OR (f.addressee_id = u.id AND f.requester_id = $1)
		WHERE u.id <> $1 AND (u.username ILIKE $2 OR u.full_name ILIKE $2)
		ORDER BY u.full_name
		LIMIT 20`

	rows, err := h.DB.Query(query, userID, like)
	if err != nil {
		log.Printf("SearchUsers error: %v", err)
		apierr.JSON(c, http.StatusInternalServerError, apierr.InternalError, "Something went wrong")
		return
	}
	defer rows.Close()

	results := []UserSearchResult{}
	for rows.Next() {
		var r UserSearchResult
		var friendshipID sql.NullInt64
		var status sql.NullString
		var requesterID sql.NullInt64
		if err := rows.Scan(&r.ID, &r.Username, &r.FullName, &r.ProfilePicture, &friendshipID, &status, &requesterID); err != nil {
			log.Printf("SearchUsers error: %v", err)
			apierr.JSON(c, http.StatusInternalServerError, apierr.InternalError, "Something went wrong")
			return
		}

		switch {
		case !status.Valid:
			r.Relationship = "none"
		case status.String == "accepted":
			r.Relationship = "friends"
		case requesterID.Valid && int(requesterID.Int64) == userID:
			r.Relationship = "outgoing"
		default:
			r.Relationship = "incoming"
		}
		if friendshipID.Valid {
			id := int(friendshipID.Int64)
			r.FriendshipID = &id
		}
		results = append(results, r)
	}
	c.JSON(http.StatusOK, results)
}

// GET /friends — accepted friends only, used both for a friends-list screen
// and to populate the @mention autocomplete.
func (h *EntryHandler) ListFriends(c *gin.Context) {
	userID := c.MustGet("user_id").(int)

	query := `
		SELECT f.id, u.id, u.username, COALESCE(u.full_name, ''), COALESCE(u.profile_picture, '')
		FROM friendships f
		JOIN users u ON u.id = CASE WHEN f.requester_id = $1 THEN f.addressee_id ELSE f.requester_id END
		WHERE (f.requester_id = $1 OR f.addressee_id = $1) AND f.status = 'accepted'
		ORDER BY u.full_name`

	rows, err := h.DB.Query(query, userID)
	if err != nil {
		log.Printf("ListFriends error: %v", err)
		apierr.JSON(c, http.StatusInternalServerError, apierr.InternalError, "Something went wrong")
		return
	}
	defer rows.Close()

	friends := []FriendListItem{}
	for rows.Next() {
		var f FriendListItem
		if err := rows.Scan(&f.FriendshipID, &f.ID, &f.Username, &f.FullName, &f.ProfilePicture); err != nil {
			log.Printf("ListFriends error: %v", err)
			apierr.JSON(c, http.StatusInternalServerError, apierr.InternalError, "Something went wrong")
			return
		}
		friends = append(friends, f)
	}
	c.JSON(http.StatusOK, friends)
}

// GET /friends/requests — pending requests where the current user is the
// addressee (i.e. requests waiting on THEM to accept/reject).
func (h *EntryHandler) ListFriendRequests(c *gin.Context) {
	userID := c.MustGet("user_id").(int)

	query := `
		SELECT f.id, 'incoming' AS direction, u.id, u.username, COALESCE(u.full_name, ''), COALESCE(u.profile_picture, ''), f.created_date
		FROM friendships f
		JOIN users u ON u.id = f.requester_id
		WHERE f.addressee_id = $1 AND f.status = 'pending'
		UNION ALL
		SELECT f.id, 'outgoing' AS direction, u.id, u.username, COALESCE(u.full_name, ''), COALESCE(u.profile_picture, ''), f.created_date
		FROM friendships f
		JOIN users u ON u.id = f.addressee_id
		WHERE f.requester_id = $1 AND f.status = 'pending'
		ORDER BY created_date DESC`

	rows, err := h.DB.Query(query, userID)
	if err != nil {
		log.Printf("ListFriendRequests error: %v", err)
		apierr.JSON(c, http.StatusInternalServerError, apierr.InternalError, "Something went wrong")
		return
	}
	defer rows.Close()

	requests := []FriendRequestItem{}
	for rows.Next() {
		var req FriendRequestItem
		var createdDate time.Time
		if err := rows.Scan(&req.ID, &req.Direction, &req.User.ID, &req.User.Username, &req.User.FullName, &req.User.ProfilePicture, &createdDate); err != nil {
			log.Printf("ListFriendRequests error: %v", err)
			apierr.JSON(c, http.StatusInternalServerError, apierr.InternalError, "Something went wrong")
			return
		}
		requests = append(requests, req)
	}
	c.JSON(http.StatusOK, requests)
}

type sendFriendRequestInput struct {
	AddresseeID int `json:"addressee_id" binding:"required"`
}

// POST /friends/request — send a request. If the target already sent us a
// pending request, this auto-accepts it instead of creating a duplicate row.
func (h *EntryHandler) SendFriendRequest(c *gin.Context) {
	userID := c.MustGet("user_id").(int)

	var input sendFriendRequestInput
	if err := c.ShouldBindJSON(&input); err != nil {
		apierr.JSON(c, http.StatusBadRequest, apierr.ValidationFailed, err.Error())
		return
	}
	if input.AddresseeID == userID {
		apierr.JSON(c, http.StatusBadRequest, apierr.CannotFriendSelf, "Cannot friend yourself")
		return
	}

	var existingID int
	var existingStatus string
	var existingRequesterID int
	err := h.DB.QueryRow(
		`SELECT id, status, requester_id FROM friendships
		 WHERE (requester_id = $1 AND addressee_id = $2) OR (requester_id = $2 AND addressee_id = $1)`,
		userID, input.AddresseeID,
	).Scan(&existingID, &existingStatus, &existingRequesterID)

	if err == nil {
		// A row already exists between these two users.
		if existingStatus == "accepted" {
			apierr.JSON(c, http.StatusConflict, apierr.AlreadyFriends, "Already friends")
			return
		}
		if existingRequesterID == userID {
			apierr.JSON(c, http.StatusConflict, apierr.FriendRequestSent, "Friend request already sent")
			return
		}
		// They requested us first — accept it instead of duplicating.
		if _, err := h.DB.Exec(`UPDATE friendships SET status = 'accepted' WHERE id = $1`, existingID); err != nil {
			log.Printf("SendFriendRequest error: %v", err)
			apierr.JSON(c, http.StatusInternalServerError, apierr.InternalError, "Something went wrong")
			return
		}
		c.JSON(http.StatusOK, gin.H{"id": existingID, "status": "accepted"})
		return
	}
	if err != sql.ErrNoRows {
		log.Printf("SendFriendRequest error: %v", err)
		apierr.JSON(c, http.StatusInternalServerError, apierr.InternalError, "Something went wrong")
		return
	}

	var newID int
	insertErr := h.DB.QueryRow(
		`INSERT INTO friendships (requester_id, addressee_id, status) VALUES ($1, $2, 'pending') RETURNING id`,
		userID, input.AddresseeID,
	).Scan(&newID)
	if insertErr != nil {
		log.Printf("SendFriendRequest error: %v", insertErr)
		apierr.JSON(c, http.StatusInternalServerError, apierr.InternalError, "Something went wrong")
		return
	}
	c.JSON(http.StatusOK, gin.H{"id": newID, "status": "pending"})
}

// POST /friends/:id/accept — only the addressee of a pending request may accept it.
func (h *EntryHandler) AcceptFriendRequest(c *gin.Context) {
	userID := c.MustGet("user_id").(int)
	friendshipID, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		apierr.JSON(c, http.StatusBadRequest, apierr.InvalidFriendshipID, "Invalid friendship id")
		return
	}

	result, err := h.DB.Exec(
		`UPDATE friendships SET status = 'accepted' WHERE id = $1 AND addressee_id = $2 AND status = 'pending'`,
		friendshipID, userID,
	)
	if err != nil {
		log.Printf("AcceptFriendRequest error: %v", err)
		apierr.JSON(c, http.StatusInternalServerError, apierr.InternalError, "Something went wrong")
		return
	}
	if rows, _ := result.RowsAffected(); rows == 0 {
		apierr.JSON(c, http.StatusNotFound, apierr.RequestNotFound, "Request not found")
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Friend request accepted"})
}

// DELETE /friends/:id — covers both rejecting a pending request and
// unfriending an accepted one; either party in the row may remove it.
func (h *EntryHandler) RemoveFriendship(c *gin.Context) {
	userID := c.MustGet("user_id").(int)
	friendshipID, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		apierr.JSON(c, http.StatusBadRequest, apierr.InvalidFriendshipID, "Invalid friendship id")
		return
	}

	result, err := h.DB.Exec(
		`DELETE FROM friendships WHERE id = $1 AND (requester_id = $2 OR addressee_id = $2)`,
		friendshipID, userID,
	)
	if err != nil {
		log.Printf("RemoveFriendship error: %v", err)
		apierr.JSON(c, http.StatusInternalServerError, apierr.InternalError, "Something went wrong")
		return
	}
	if rows, _ := result.RowsAffected(); rows == 0 {
		apierr.JSON(c, http.StatusNotFound, apierr.FriendshipNotFound, "Friendship not found")
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Removed"})
}
