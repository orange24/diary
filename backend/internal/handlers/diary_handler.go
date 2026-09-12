package handlers

import (
	"database/sql"
	"diary_app/backend/internal/apierr"
	"diary_app/backend/internal/models"
	"encoding/json"
	"log"
	"os"
	"regexp"
	"strconv"

	"github.com/cloudinary/cloudinary-go/v2"
	"github.com/cloudinary/cloudinary-go/v2/api/uploader"
	"github.com/gin-gonic/gin"
	"github.com/lib/pq"
)

type EntryHandler struct {
	DB *sql.DB
}

// normalizeAudience falls back to "private" for anything the DB's CHECK
// constraint wouldn't accept, so a missing/typo'd value from an older
// client can't fail the insert/update outright.
func normalizeAudience(audience string) string {
	switch audience {
	case "friend", "public":
		return audience
	default:
		return "private"
	}
}

// 1. GetEntries: ของตัวเอง + ของเพื่อนที่ tag เราไว้และเปิดเป็น public/friend
func (h *EntryHandler) GetEntries(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "10"))
	offset := (page - 1) * limit

	// ดึง userID จาก Middleware (ที่เก็บไว้ใน Context ของ Gin)
	userID := c.MustGet("user_id")

	// A mention is stored as literal "@username" text inside the scrapbook
	// layout — build a word-bounded regex for it once so a friend's post
	// only surfaces here when it actually tags this user, not merely
	// contains their username as a substring of something else.
	var username string
	_ = h.DB.QueryRow("SELECT username FROM users WHERE id = $1", userID).Scan(&username)

	// Own entries always show. A friend's entry also shows once it (a) is
	// marked public or friend-visible, (b) tags this user by @username, (c)
	// the poster is an accepted friend, and (d) — for friend-visible entries
	// specifically — this viewer isn't excluded by the author's friend-group
	// scoping: an entry with no entry_friend_groups rows at all is "all
	// friends" (unrestricted); one with rows requires the viewer to belong
	// to at least one of them. Public entries skip (d) entirely — groups
	// only ever narrow "friend" visibility, never "public". Skipped
	// entirely if the username lookup failed, rather than risk a pattern
	// that accidentally matches everything.
	mergeFriendsClause := ""
	args := []interface{}{userID, limit, offset}
	if username != "" {
		mergeFriendsClause = `
			     OR (
			       e.audience IN ('public', 'friend')
			       AND e.layout::text ~ $4
			       AND EXISTS (
			         SELECT 1 FROM friendships f
			         WHERE f.status = 'accepted'
			           AND ((f.requester_id = $1 AND f.addressee_id = e.user_id)
			             OR (f.addressee_id = $1 AND f.requester_id = e.user_id))
			       )
			       AND (
			         e.audience = 'public'
			         OR NOT EXISTS (SELECT 1 FROM entry_friend_groups efg WHERE efg.entry_id = e.id)
			         OR EXISTS (
			           SELECT 1 FROM entry_friend_groups efg
			           JOIN friend_group_members fgm ON fgm.group_id = efg.group_id
			           WHERE efg.entry_id = e.id AND fgm.friend_user_id = $1
			         )
			       )
			     )`
		args = append(args, "@"+regexp.QuoteMeta(username)+`\y`)
	}

	// A Contact's @handle also counts as a mention once the OTHER party has
	// approved linking that contact to their real account (see
	// contact_handler.go) — same friendship + audience/group visibility
	// rules as a direct @username mention above, just resolved through the
	// contacts table instead of the viewer's own username. Handles are
	// constrained (migration 0008's CHECK) to a charset with no regex
	// metacharacters, so concatenating one directly into the pattern here
	// is safe. No new $N params needed — only ever references $1 (userID).
	contactMentionClause := `
		     OR (
		       e.audience IN ('public', 'friend')
		       AND EXISTS (
		         SELECT 1 FROM contacts ct
		         WHERE ct.owner_id = e.user_id
		           AND ct.linked_user_id = $1
		           AND ct.link_status = 'accepted'
		           AND e.layout::text ~ ('@' || ct.handle || '\y')
		       )
		       AND EXISTS (
		         SELECT 1 FROM friendships f
		         WHERE f.status = 'accepted'
		           AND ((f.requester_id = $1 AND f.addressee_id = e.user_id)
		             OR (f.addressee_id = $1 AND f.requester_id = e.user_id))
		       )
		       AND (
		         e.audience = 'public'
		         OR NOT EXISTS (SELECT 1 FROM entry_friend_groups efg WHERE efg.entry_id = e.id)
		         OR EXISTS (
		           SELECT 1 FROM entry_friend_groups efg
		           JOIN friend_group_members fgm ON fgm.group_id = efg.group_id
		           WHERE efg.entry_id = e.id AND fgm.friend_user_id = $1
		         )
		       )
		     )`

	// created_date is a "timestamp without time zone" (a naive wall-clock
	// value, no zone attached) — reading it back through Go's time.Time
	// would silently stamp it as UTC and shift it when the frontend
	// re-parses it as local time. to_char keeps it a plain string so the
	// literal value the user entered round-trips unchanged.
	query := `SELECT e.id, e.title, e.content, to_char(e.created_date, 'YYYY-MM-DD"T"HH24:MI:SS'), COALESCE(e.created_by, ''), e.images, e.layout, e.audience, e.user_id, COALESCE(u.profile_picture, ''), COALESCE(u.slug, '')
			  FROM entries e
			  LEFT JOIN users u ON u.id = e.user_id
			  WHERE e.user_id = $1` + mergeFriendsClause + contactMentionClause + `
			  ORDER BY e.id DESC LIMIT $2 OFFSET $3`

	rows, err := h.DB.Query(query, args...)
	if err != nil {
		log.Printf("GetEntries query error: %v", err)
		apierr.JSON(c, 500, apierr.InternalError, "Something went wrong")
		return
	}
	defer rows.Close()

	var entries []models.Entry = []models.Entry{} // ป้องกันการส่ง null กลับไปถ้าไม่มีข้อมูล
	for rows.Next() {
		var e models.Entry
		var layoutStr sql.NullString
		err := rows.Scan(&e.ID, &e.Title, &e.Content, &e.CreatedDate, &e.CreatedBy, &e.Images, &layoutStr, &e.Audience, &e.UserID, &e.CreatedByAvatar, &e.CreatedBySlug)
		if err != nil {
			log.Printf("GetEntries scan error: %v", err)
			apierr.JSON(c, 500, apierr.InternalError, "Something went wrong")
			return
		}
		if layoutStr.Valid {
			e.Layout = json.RawMessage(layoutStr.String)
		}
		entries = append(entries, e)
	}
	c.JSON(200, entries)
}

// setEntryFriendGroups replaces which of the caller's own friend_groups an
// entry is scoped to. Pass a nil/empty groupIDs to clear scoping entirely
// (the "all friends" / not-friend-audience state). Any id in groupIDs the
// caller doesn't own is silently dropped rather than erroring, matching
// normalizeAudience's "fall back, don't fail" style for client-supplied
// values.
func (h *EntryHandler) setEntryFriendGroups(entryID int, userID interface{}, groupIDs []int) error {
	if _, err := h.DB.Exec(`DELETE FROM entry_friend_groups WHERE entry_id = $1`, entryID); err != nil {
		return err
	}
	if len(groupIDs) == 0 {
		return nil
	}
	_, err := h.DB.Exec(
		`INSERT INTO entry_friend_groups (entry_id, group_id)
		 SELECT $1, fg.id FROM friend_groups fg WHERE fg.id = ANY($2) AND fg.owner_id = $3`,
		entryID, pq.Array(groupIDs), userID,
	)
	return err
}

// 1b. GetNosyFeed: public entries from OTHER users, ranked by unique-viewer
// count then by most recent update — "nosy mode". Viewing a page of results
// also records this viewer against every entry on it (entry_views, deduped
// by primary key), which is what makes the ranking possible in the first
// place: there's no separate "mark as viewed" endpoint, appearing in this
// feed IS the view.
func (h *EntryHandler) GetNosyFeed(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "10"))
	offset := (page - 1) * limit

	userID := c.MustGet("user_id")

	query := `SELECT e.id, e.title, e.content, to_char(e.created_date, 'YYYY-MM-DD"T"HH24:MI:SS'), COALESCE(e.created_by, ''), e.images, e.layout, e.audience, e.user_id, COALESCE(u.profile_picture, ''), COALESCE(u.slug, ''), COALESCE(v.view_count, 0)
			  FROM entries e
			  LEFT JOIN users u ON u.id = e.user_id
			  LEFT JOIN (
			    SELECT entry_id, COUNT(*) AS view_count FROM entry_views GROUP BY entry_id
			  ) v ON v.entry_id = e.id
			  WHERE e.audience = 'public' AND e.user_id != $1
			  ORDER BY COALESCE(v.view_count, 0) DESC, e.updated_at DESC
			  LIMIT $2 OFFSET $3`

	rows, err := h.DB.Query(query, userID, limit, offset)
	if err != nil {
		log.Printf("GetNosyFeed query error: %v", err)
		apierr.JSON(c, 500, apierr.InternalError, "Something went wrong")
		return
	}
	defer rows.Close()

	var entries []models.Entry = []models.Entry{}
	for rows.Next() {
		var e models.Entry
		var layoutStr sql.NullString
		err := rows.Scan(&e.ID, &e.Title, &e.Content, &e.CreatedDate, &e.CreatedBy, &e.Images, &layoutStr, &e.Audience, &e.UserID, &e.CreatedByAvatar, &e.CreatedBySlug, &e.ViewCount)
		if err != nil {
			log.Printf("GetNosyFeed scan error: %v", err)
			apierr.JSON(c, 500, apierr.InternalError, "Something went wrong")
			return
		}
		if layoutStr.Valid {
			e.Layout = json.RawMessage(layoutStr.String)
		}
		entries = append(entries, e)
	}

	// Record this page as viewed by this user. Best-effort: a failure here
	// shouldn't turn a successful feed load into an error response, since
	// the view record is a side effect of reading, not the point of the
	// request.
	for _, e := range entries {
		if _, err := h.DB.Exec(
			"INSERT INTO entry_views (entry_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
			e.ID, userID,
		); err != nil {
			log.Printf("GetNosyFeed view-record error (entry %d): %v", e.ID, err)
		}
	}

	c.JSON(200, entries)
}

// 2. CreateEntry: ผูก user_id ตอนสร้าง
func (h *EntryHandler) CreateEntry(c *gin.Context) {
	var input models.Entry
	if err := c.ShouldBindJSON(&input); err != nil {
		apierr.JSON(c, 400, apierr.ValidationFailed, err.Error())
		return
	}

	userID := c.MustGet("user_id")

	var layoutParam interface{}
	if len(input.Layout) > 0 {
		layoutParam = string(input.Layout)
	}
	input.Audience = normalizeAudience(input.Audience)

	// A blank/omitted date falls back to CURRENT_TIMESTAMP; the frontend's
	// date picker normally always sends one.
	var createdDateParam interface{}
	if input.CreatedDate != "" {
		createdDateParam = input.CreatedDate
	}

	// เพิ่ม user_id และ layout ลงใน INSERT query
	query := `INSERT INTO entries (title, content, created_by, images, user_id, layout, audience, created_date)
              VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, COALESCE($8, CURRENT_TIMESTAMP))
              RETURNING id, to_char(created_date, 'YYYY-MM-DD"T"HH24:MI:SS')`

	err := h.DB.QueryRow(query, input.Title, input.Content, input.CreatedBy, pq.Array(input.Images), userID, layoutParam, input.Audience, createdDateParam).
		Scan(&input.ID, &input.CreatedDate)

	if err != nil {
		log.Printf("CreateEntry error: %v", err)
		apierr.JSON(c, 500, apierr.EntryCreateFailed, "Failed to create entry")
		return
	}

	// Group scoping only ever applies to "friend"-audience entries — any
	// group ids sent alongside a different audience are dropped.
	groupIDsToSet := input.FriendGroupIDs
	if input.Audience != "friend" {
		groupIDsToSet = nil
	}
	if err := h.setEntryFriendGroups(input.ID, userID, groupIDsToSet); err != nil {
		log.Printf("CreateEntry group-scope error: %v", err)
	}
	input.FriendGroupIDs = groupIDsToSet

	c.JSON(200, input)
}

// 3. DeleteEntry: ต้องเช็คว่าเป็นเจ้าของไหม
func (h *EntryHandler) DeleteEntry(c *gin.Context) {
	id := c.Param("id")
	userID := c.MustGet("user_id")

	// ป้องกันไม่ให้คนอื่นมาลบ ID ที่ไม่ใช่ของตัวเอง
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

	c.JSON(200, gin.H{"message": "Entry deleted successfully"})
}

// 4. UpdateEntry: ต้องเช็คว่าเป็นเจ้าของไหม
func (h *EntryHandler) UpdateEntry(c *gin.Context) {
	id := c.Param("id")
	userID := c.MustGet("user_id")
	var input models.Entry
	if err := c.ShouldBindJSON(&input); err != nil {
		apierr.JSON(c, 400, apierr.ValidationFailed, err.Error())
		return
	}

	var layoutParam interface{}
	if len(input.Layout) > 0 {
		layoutParam = string(input.Layout)
	}
	input.Audience = normalizeAudience(input.Audience)

	// A blank/omitted date leaves the existing created_date untouched.
	var createdDateParam interface{}
	if input.CreatedDate != "" {
		createdDateParam = input.CreatedDate
	}

	query := `UPDATE entries SET title = $1, content = $2, created_by = $3, images = $4, layout = $5::jsonb, audience = $6, created_date = COALESCE($7, created_date), updated_at = CURRENT_TIMESTAMP
			  WHERE id = $8 AND user_id = $9`
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

	entryID, _ := strconv.Atoi(id)
	groupIDsToSet := input.FriendGroupIDs
	if input.Audience != "friend" {
		groupIDsToSet = nil
	}
	if err := h.setEntryFriendGroups(entryID, userID, groupIDsToSet); err != nil {
		log.Printf("UpdateEntry group-scope error: %v", err)
	}

	c.JSON(200, gin.H{"message": "Entry updated successfully"})
}

// 5. GetEntry (Single): ต้องเช็ค user_id
func (h *EntryHandler) GetEntry(c *gin.Context) {
	id := c.Param("id")
	userID := c.MustGet("user_id")
	var e models.Entry

	query := `SELECT id, title, content, to_char(created_date, 'YYYY-MM-DD"T"HH24:MI:SS'), created_by, images, layout, audience,
			  COALESCE((SELECT array_agg(group_id) FROM entry_friend_groups WHERE entry_id = entries.id), ARRAY[]::int[])
			  FROM entries WHERE id = $1 AND user_id = $2`
	var layoutStr sql.NullString
	var groupIDs pq.Int64Array
	err := h.DB.QueryRow(query, id, userID).
		Scan(&e.ID, &e.Title, &e.Content, &e.CreatedDate, &e.CreatedBy, &e.Images, &layoutStr, &e.Audience, &groupIDs)
	if err == nil {
		if layoutStr.Valid {
			e.Layout = json.RawMessage(layoutStr.String)
		}
		e.FriendGroupIDs = make([]int, len(groupIDs))
		for i, gid := range groupIDs {
			e.FriendGroupIDs[i] = int(gid)
		}
	}

	if err != nil {
		if err == sql.ErrNoRows {
			apierr.JSON(c, 404, apierr.EntryNotFound, "Entry not found or unauthorized")
		} else {
			log.Printf("GetEntry error: %v", err)
			apierr.JSON(c, 500, apierr.InternalError, "Something went wrong")
		}
		return
	}
	c.JSON(200, e)
}

func (h *EntryHandler) UploadFiles(c *gin.Context) {
	// 1. ตรวจสอบว่ามี CLOUDINARY_URL หรือไม่
	cloudinaryURL := os.Getenv("CLOUDINARY_URL")
	if cloudinaryURL == "" {
		apierr.JSON(c, 500, apierr.StorageNotConfigured, "Storage service is not configured")
		return
	}
	log.Println("cloudinaryURL = ", cloudinaryURL)

	// 2. สร้าง Instance และเช็ค Error ทันที
	cld, err := cloudinary.NewFromURL(cloudinaryURL)
	if err != nil {
		log.Printf("Failed to init Cloudinary: %v", err)
		apierr.JSON(c, 500, apierr.StorageInitFailed, "Failed to initialize storage service")
		return
	}

	form, err := c.MultipartForm()

	log.Println("cloudinaryURL err = ", err)
	if err != nil {
		apierr.JSON(c, 400, apierr.InvalidFormData, "Invalid form data")
		return
	}

	files := form.File["media"]
	log.Println("cloudinaryURL files = ", files)
	var paths []string

	for _, fileHeader := range files {
		file, err := fileHeader.Open()
		if err != nil {
			continue
		}
		defer file.Close()

		// ตอนนี้ cld จะไม่เป็น nil แล้วครับ
		uploadRes, err := cld.Upload.Upload(c.Request.Context(), file, uploader.UploadParams{
			Folder: "my_diary_app",
		})

		if err != nil {
			log.Printf("Cloudinary upload error: %v", err)
			apierr.JSON(c, 500, apierr.UploadFailed, "Upload failed")
			return
		}

		log.Println("cloudinaryURL uploadRes.SecureURL = ", uploadRes.SecureURL)
		paths = append(paths, uploadRes.SecureURL)
	}

	c.JSON(200, gin.H{"paths": paths})
}
