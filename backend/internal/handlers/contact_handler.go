package handlers

import (
	"database/sql"
	"log"
	"net/http"
	"regexp"
	"strconv"
	"strings"
	"unicode"

	"diary_app/backend/internal/apierr"
	"github.com/gin-gonic/gin"
)

// A Contact is a placeholder person an owner can @-mention in entries
// without that person needing a Papymory account (e.g. "son A"). If they
// later sign up for real, the owner can request to link this contact to
// their real account — LinkStatus stays "pending" until the OTHER party
// approves, at which point mentioning this contact's Handle starts
// surfacing posts in the linked user's real feed exactly like a normal
// @username mention would (see diary_handler.go's GetEntries).
type Contact struct {
	ID           int         `json:"id"`
	Name         string      `json:"name"`
	Handle       string      `json:"handle"`
	Relationship string      `json:"relationship"`
	LinkStatus   *string     `json:"link_status"`
	LinkedUser   *FriendUser `json:"linked_user,omitempty"`
}

// mentionHandleCharset matches the same charset the existing @mention/
// #hashtag trigger already accepts (Unicode letters/numbers plus
// underscore) — handles need not be ASCII since this is a Thai-language
// app. Anything outside this set is stripped when auto-deriving a handle
// from a name.
var mentionHandleCharset = regexp.MustCompile(`[\p{L}\p{N}_]+`)

func slugifyHandle(name string) string {
	parts := mentionHandleCharset.FindAllString(name, -1)
	slug := strings.Join(parts, "")
	if slug == "" {
		slug = "contact"
	}
	// Cap well under the column's 50-char limit so an appended
	// disambiguating suffix (see uniqueHandle) always fits.
	runes := []rune(slug)
	if len(runes) > 40 {
		slug = string(runes[:40])
	}
	return slug
}

func isValidHandle(handle string) bool {
	if handle == "" {
		return false
	}
	for _, r := range handle {
		if !unicode.IsLetter(r) && !unicode.IsDigit(r) && r != '_' {
			return false
		}
	}
	return true
}

// uniqueHandle appends a numeric suffix until the (owner, handle) pair is
// free — contact handles only need to be unique within one owner's own
// list, never globally.
func (h *EntryHandler) uniqueHandle(ownerID int, base string, excludeContactID int) (string, error) {
	candidate := base
	for i := 1; ; i++ {
		var exists bool
		err := h.DB.QueryRow(
			`SELECT EXISTS(SELECT 1 FROM contacts WHERE owner_id = $1 AND handle = $2 AND id <> $3)`,
			ownerID, candidate, excludeContactID,
		).Scan(&exists)
		if err != nil {
			return "", err
		}
		if !exists {
			return candidate, nil
		}
		candidate = base + strconv.Itoa(i)
	}
}

func (h *EntryHandler) scanContact(scan func(dest ...interface{}) error) (Contact, error) {
	var c Contact
	var linkStatus sql.NullString
	var linkedID sql.NullInt64
	var linkedUsername, linkedFullName, linkedAvatar sql.NullString
	err := scan(&c.ID, &c.Name, &c.Handle, &c.Relationship, &linkStatus, &linkedID, &linkedUsername, &linkedFullName, &linkedAvatar)
	if err != nil {
		return c, err
	}
	if linkStatus.Valid {
		c.LinkStatus = &linkStatus.String
	}
	if linkedID.Valid {
		c.LinkedUser = &FriendUser{
			ID:             int(linkedID.Int64),
			Username:       linkedUsername.String,
			FullName:       linkedFullName.String,
			ProfilePicture: linkedAvatar.String,
		}
	}
	return c, nil
}

const contactSelectColumns = `c.id, c.name, c.handle, c.relationship, c.link_status,
	u.id, u.username, COALESCE(u.full_name, ''), COALESCE(u.profile_picture, '')`

// GET /contacts — the caller's own contacts, placeholder or linked.
func (h *EntryHandler) ListContacts(c *gin.Context) {
	userID := c.MustGet("user_id").(int)

	rows, err := h.DB.Query(
		`SELECT `+contactSelectColumns+`
		 FROM contacts c
		 LEFT JOIN users u ON u.id = c.linked_user_id
		 WHERE c.owner_id = $1
		 ORDER BY c.name`,
		userID,
	)
	if err != nil {
		log.Printf("ListContacts error: %v", err)
		apierr.JSON(c, http.StatusInternalServerError, apierr.InternalError, "Something went wrong")
		return
	}
	defer rows.Close()

	contacts := []Contact{}
	for rows.Next() {
		contact, err := h.scanContact(rows.Scan)
		if err != nil {
			log.Printf("ListContacts scan error: %v", err)
			apierr.JSON(c, http.StatusInternalServerError, apierr.InternalError, "Something went wrong")
			return
		}
		contacts = append(contacts, contact)
	}
	c.JSON(http.StatusOK, contacts)
}

type createContactInput struct {
	Name         string `json:"name" binding:"required"`
	Relationship string `json:"relationship"`
}

// POST /contacts
func (h *EntryHandler) CreateContact(c *gin.Context) {
	userID := c.MustGet("user_id").(int)

	var input createContactInput
	if err := c.ShouldBindJSON(&input); err != nil {
		apierr.JSON(c, http.StatusBadRequest, apierr.ValidationFailed, err.Error())
		return
	}

	handle, err := h.uniqueHandle(userID, slugifyHandle(input.Name), 0)
	if err != nil {
		log.Printf("CreateContact error: %v", err)
		apierr.JSON(c, http.StatusInternalServerError, apierr.InternalError, "Something went wrong")
		return
	}

	var id int
	err = h.DB.QueryRow(
		`INSERT INTO contacts (owner_id, name, handle, relationship) VALUES ($1, $2, $3, $4) RETURNING id`,
		userID, input.Name, handle, input.Relationship,
	).Scan(&id)
	if err != nil {
		log.Printf("CreateContact error: %v", err)
		apierr.JSON(c, http.StatusInternalServerError, apierr.InternalError, "Something went wrong")
		return
	}
	c.JSON(http.StatusOK, Contact{ID: id, Name: input.Name, Handle: handle, Relationship: input.Relationship})
}

type updateContactInput struct {
	Name         string  `json:"name" binding:"required"`
	Relationship string  `json:"relationship"`
	Handle       *string `json:"handle"`
}

// PUT /contacts/:id — the handle may be edited explicitly; an omitted
// handle leaves the existing one untouched (renaming the display Name
// does NOT regenerate it, so existing @mentions in past entries keep
// resolving to this contact).
func (h *EntryHandler) UpdateContact(c *gin.Context) {
	userID := c.MustGet("user_id").(int)
	contactID, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		apierr.JSON(c, http.StatusBadRequest, apierr.InvalidContactID, "Invalid contact id")
		return
	}

	var input updateContactInput
	if err := c.ShouldBindJSON(&input); err != nil {
		apierr.JSON(c, http.StatusBadRequest, apierr.ValidationFailed, err.Error())
		return
	}

	var handleParam interface{}
	if input.Handle != nil {
		if !isValidHandle(*input.Handle) {
			apierr.JSON(c, http.StatusBadRequest, apierr.ValidationFailed, "Handle must be letters, numbers, or underscore only")
			return
		}
		var taken bool
		if err := h.DB.QueryRow(
			`SELECT EXISTS(SELECT 1 FROM contacts WHERE owner_id = $1 AND handle = $2 AND id <> $3)`,
			userID, *input.Handle, contactID,
		).Scan(&taken); err != nil {
			log.Printf("UpdateContact error: %v", err)
			apierr.JSON(c, http.StatusInternalServerError, apierr.InternalError, "Something went wrong")
			return
		}
		if taken {
			apierr.JSON(c, http.StatusConflict, apierr.HandleTaken, "You already have a contact with that handle")
			return
		}
		handleParam = *input.Handle
	}

	result, err := h.DB.Exec(
		`UPDATE contacts SET name = $1, relationship = $2, handle = COALESCE($3, handle)
		 WHERE id = $4 AND owner_id = $5`,
		input.Name, input.Relationship, handleParam, contactID, userID,
	)
	if err != nil {
		log.Printf("UpdateContact error: %v", err)
		apierr.JSON(c, http.StatusInternalServerError, apierr.InternalError, "Something went wrong")
		return
	}
	if rows, _ := result.RowsAffected(); rows == 0 {
		apierr.JSON(c, http.StatusNotFound, apierr.ContactNotFound, "Contact not found")
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Updated"})
}

// DELETE /contacts/:id
func (h *EntryHandler) DeleteContact(c *gin.Context) {
	userID := c.MustGet("user_id").(int)
	contactID, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		apierr.JSON(c, http.StatusBadRequest, apierr.InvalidContactID, "Invalid contact id")
		return
	}

	result, err := h.DB.Exec(`DELETE FROM contacts WHERE id = $1 AND owner_id = $2`, contactID, userID)
	if err != nil {
		log.Printf("DeleteContact error: %v", err)
		apierr.JSON(c, http.StatusInternalServerError, apierr.InternalError, "Something went wrong")
		return
	}
	if rows, _ := result.RowsAffected(); rows == 0 {
		apierr.JSON(c, http.StatusNotFound, apierr.ContactNotFound, "Contact not found")
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Deleted"})
}

type requestContactLinkInput struct {
	TargetUserID int `json:"target_user_id" binding:"required"`
}

// POST /contacts/:id/link — owner requests to link a placeholder contact to
// a real account. Requires an existing accepted friendship with the
// target; the target must still approve before the link takes effect.
func (h *EntryHandler) RequestContactLink(c *gin.Context) {
	userID := c.MustGet("user_id").(int)
	contactID, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		apierr.JSON(c, http.StatusBadRequest, apierr.InvalidContactID, "Invalid contact id")
		return
	}

	var input requestContactLinkInput
	if err := c.ShouldBindJSON(&input); err != nil {
		apierr.JSON(c, http.StatusBadRequest, apierr.ValidationFailed, err.Error())
		return
	}

	var currentStatus sql.NullString
	err = h.DB.QueryRow(`SELECT link_status FROM contacts WHERE id = $1 AND owner_id = $2`, contactID, userID).Scan(&currentStatus)
	if err == sql.ErrNoRows {
		apierr.JSON(c, http.StatusNotFound, apierr.ContactNotFound, "Contact not found")
		return
	} else if err != nil {
		log.Printf("RequestContactLink error: %v", err)
		apierr.JSON(c, http.StatusInternalServerError, apierr.InternalError, "Something went wrong")
		return
	}
	if currentStatus.Valid {
		apierr.JSON(c, http.StatusConflict, apierr.ContactAlreadyLinked, "This contact is already linked or has a pending link")
		return
	}

	var friendCheck int
	err = h.DB.QueryRow(
		`SELECT id FROM friendships WHERE status = 'accepted'
		 AND ((requester_id = $1 AND addressee_id = $2) OR (requester_id = $2 AND addressee_id = $1))`,
		userID, input.TargetUserID,
	).Scan(&friendCheck)
	if err == sql.ErrNoRows {
		apierr.JSON(c, http.StatusBadRequest, apierr.NotYourFriend, "That person isn't your friend")
		return
	} else if err != nil {
		log.Printf("RequestContactLink error: %v", err)
		apierr.JSON(c, http.StatusInternalServerError, apierr.InternalError, "Something went wrong")
		return
	}

	if _, err := h.DB.Exec(
		`UPDATE contacts SET linked_user_id = $1, link_status = 'pending' WHERE id = $2 AND owner_id = $3`,
		input.TargetUserID, contactID, userID,
	); err != nil {
		log.Printf("RequestContactLink error: %v", err)
		apierr.JSON(c, http.StatusInternalServerError, apierr.InternalError, "Something went wrong")
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Link requested"})
}

// POST /contacts/:id/link/accept — only the linked (target) user may accept.
func (h *EntryHandler) AcceptContactLink(c *gin.Context) {
	userID := c.MustGet("user_id").(int)
	contactID, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		apierr.JSON(c, http.StatusBadRequest, apierr.InvalidContactID, "Invalid contact id")
		return
	}

	result, err := h.DB.Exec(
		`UPDATE contacts SET link_status = 'accepted' WHERE id = $1 AND linked_user_id = $2 AND link_status = 'pending'`,
		contactID, userID,
	)
	if err != nil {
		log.Printf("AcceptContactLink error: %v", err)
		apierr.JSON(c, http.StatusInternalServerError, apierr.InternalError, "Something went wrong")
		return
	}
	if rows, _ := result.RowsAffected(); rows == 0 {
		apierr.JSON(c, http.StatusNotFound, apierr.ContactNotFound, "Contact not found")
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Link accepted"})
}

// POST /contacts/:id/link/decline — either the owner (cancelling their own
// outgoing request) or the target (declining an incoming one) may clear a
// pending link. Once accepted, this also serves as "unlink".
func (h *EntryHandler) DeclineContactLink(c *gin.Context) {
	userID := c.MustGet("user_id").(int)
	contactID, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		apierr.JSON(c, http.StatusBadRequest, apierr.InvalidContactID, "Invalid contact id")
		return
	}

	result, err := h.DB.Exec(
		`UPDATE contacts SET linked_user_id = NULL, link_status = NULL
		 WHERE id = $1 AND (owner_id = $2 OR linked_user_id = $2)`,
		contactID, userID,
	)
	if err != nil {
		log.Printf("DeclineContactLink error: %v", err)
		apierr.JSON(c, http.StatusInternalServerError, apierr.InternalError, "Something went wrong")
		return
	}
	if rows, _ := result.RowsAffected(); rows == 0 {
		apierr.JSON(c, http.StatusNotFound, apierr.ContactNotFound, "Contact not found")
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Link removed"})
}

// ContactLinkRequestItem is one pending link request, from either side's
// point of view — "incoming" (someone wants to link YOU as their [x]) or
// "outgoing" (a contact of yours, awaiting the other side's approval).
type ContactLinkRequestItem struct {
	ContactID    int        `json:"contact_id"`
	Name         string     `json:"name"`
	Relationship string     `json:"relationship"`
	Direction    string     `json:"direction"`
	OtherUser    FriendUser `json:"other_user"`
}

// GET /contacts/requests
func (h *EntryHandler) ListContactLinkRequests(c *gin.Context) {
	userID := c.MustGet("user_id").(int)

	rows, err := h.DB.Query(`
		SELECT c.id, c.name, c.relationship, 'incoming' AS direction,
		       u.id, u.username, COALESCE(u.full_name, ''), COALESCE(u.profile_picture, '')
		FROM contacts c
		JOIN users u ON u.id = c.owner_id
		WHERE c.linked_user_id = $1 AND c.link_status = 'pending'
		UNION ALL
		SELECT c.id, c.name, c.relationship, 'outgoing' AS direction,
		       u.id, u.username, COALESCE(u.full_name, ''), COALESCE(u.profile_picture, '')
		FROM contacts c
		JOIN users u ON u.id = c.linked_user_id
		WHERE c.owner_id = $1 AND c.link_status = 'pending'`,
		userID,
	)
	if err != nil {
		log.Printf("ListContactLinkRequests error: %v", err)
		apierr.JSON(c, http.StatusInternalServerError, apierr.InternalError, "Something went wrong")
		return
	}
	defer rows.Close()

	requests := []ContactLinkRequestItem{}
	for rows.Next() {
		var r ContactLinkRequestItem
		if err := rows.Scan(&r.ContactID, &r.Name, &r.Relationship, &r.Direction,
			&r.OtherUser.ID, &r.OtherUser.Username, &r.OtherUser.FullName, &r.OtherUser.ProfilePicture); err != nil {
			log.Printf("ListContactLinkRequests scan error: %v", err)
			apierr.JSON(c, http.StatusInternalServerError, apierr.InternalError, "Something went wrong")
			return
		}
		requests = append(requests, r)
	}
	c.JSON(http.StatusOK, requests)
}
