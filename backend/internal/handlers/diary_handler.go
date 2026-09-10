package handlers

import (
	"database/sql"
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
	// marked public or friend-visible, (b) tags this user by @username, and
	// (c) the poster is an accepted friend — so being tagged in someone
	// else's public post doesn't require friendship, but "friend"-audience
	// posts still stay within the friend circle. Skipped entirely if the
	// username lookup failed, rather than risk a pattern that accidentally
	// matches everything.
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
			     )`
		args = append(args, "@"+regexp.QuoteMeta(username)+`\y`)
	}

	query := `SELECT e.id, e.title, e.content, e.created_date, COALESCE(e.created_by, ''), e.images, e.layout, e.audience, e.user_id, COALESCE(u.profile_picture, '')
			  FROM entries e
			  LEFT JOIN users u ON u.id = e.user_id
			  WHERE e.user_id = $1` + mergeFriendsClause + `
			  ORDER BY e.id DESC LIMIT $2 OFFSET $3`

	rows, err := h.DB.Query(query, args...)
	if err != nil {
		c.JSON(500, gin.H{"error": err.Error()})
		return
	}
	defer rows.Close()

	var entries []models.Entry = []models.Entry{} // ป้องกันการส่ง null กลับไปถ้าไม่มีข้อมูล
	for rows.Next() {
		var e models.Entry
		var layoutStr sql.NullString
		err := rows.Scan(&e.ID, &e.Title, &e.Content, &e.CreatedDate, &e.CreatedBy, &e.Images, &layoutStr, &e.Audience, &e.UserID, &e.CreatedByAvatar)
		if err != nil {
			c.JSON(500, gin.H{"error": "Scan error: " + err.Error()})
			return
		}
		if layoutStr.Valid {
			e.Layout = json.RawMessage(layoutStr.String)
		}
		entries = append(entries, e)
	}
	c.JSON(200, entries)
}

// 2. CreateEntry: ผูก user_id ตอนสร้าง
func (h *EntryHandler) CreateEntry(c *gin.Context) {
	var input models.Entry
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(400, gin.H{"error": err.Error()})
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
              VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, COALESCE($8, CURRENT_TIMESTAMP)) RETURNING id, created_date`

	err := h.DB.QueryRow(query, input.Title, input.Content, input.CreatedBy, pq.Array(input.Images), userID, layoutParam, input.Audience, createdDateParam).
		Scan(&input.ID, &input.CreatedDate)

	if err != nil {
		c.JSON(500, gin.H{"error": "Failed to create entry: " + err.Error()})
		return
	}
	c.JSON(200, input)
}

// 3. DeleteEntry: ต้องเช็คว่าเป็นเจ้าของไหม
func (h *EntryHandler) DeleteEntry(c *gin.Context) {
	id := c.Param("id")
	userID := c.MustGet("user_id")

	// ป้องกันไม่ให้คนอื่นมาลบ ID ที่ไม่ใช่ของตัวเอง
	res, err := h.DB.Exec("DELETE FROM entries WHERE id = $1 AND user_id = $2", id, userID)
	if err != nil {
		c.JSON(500, gin.H{"error": "Failed to delete entry"})
		return
	}

	count, _ := res.RowsAffected()
	if count == 0 {
		c.JSON(403, gin.H{"error": "You don't have permission to delete this entry"})
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
		c.JSON(400, gin.H{"error": err.Error()})
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

	query := `UPDATE entries SET title = $1, content = $2, created_by = $3, images = $4, layout = $5::jsonb, audience = $6, created_date = COALESCE($7, created_date)
			  WHERE id = $8 AND user_id = $9`
	res, err := h.DB.Exec(query, input.Title, input.Content, input.CreatedBy, pq.Array(input.Images), layoutParam, input.Audience, createdDateParam, id, userID)

	if err != nil {
		c.JSON(500, gin.H{"error": "Failed to update entry"})
		return
	}

	count, _ := res.RowsAffected()
	if count == 0 {
		c.JSON(403, gin.H{"error": "You don't have permission to update this entry"})
		return
	}

	c.JSON(200, gin.H{"message": "Entry updated successfully"})
}

// 5. GetEntry (Single): ต้องเช็ค user_id
func (h *EntryHandler) GetEntry(c *gin.Context) {
	id := c.Param("id")
	userID := c.MustGet("user_id")
	var e models.Entry

	query := `SELECT id, title, content, created_date, created_by, images, layout, audience
			  FROM entries WHERE id = $1 AND user_id = $2`
	var layoutStr sql.NullString
	err := h.DB.QueryRow(query, id, userID).
		Scan(&e.ID, &e.Title, &e.Content, &e.CreatedDate, &e.CreatedBy, &e.Images, &layoutStr, &e.Audience)
	if err == nil && layoutStr.Valid {
		e.Layout = json.RawMessage(layoutStr.String)
	}

	if err != nil {
		if err == sql.ErrNoRows {
			c.JSON(404, gin.H{"error": "Entry not found or unauthorized"})
		} else {
			c.JSON(500, gin.H{"error": err.Error()})
		}
		return
	}
	c.JSON(200, e)
}

func (h *EntryHandler) UploadFiles(c *gin.Context) {
	// 1. ตรวจสอบว่ามี CLOUDINARY_URL หรือไม่
	cloudinaryURL := os.Getenv("CLOUDINARY_URL")
	if cloudinaryURL == "" {
		c.JSON(500, gin.H{"error": "Cloudinary configuration missing"})
		return
	}
	log.Println("cloudinaryURL = ", cloudinaryURL)

	// 2. สร้าง Instance และเช็ค Error ทันที
	cld, err := cloudinary.NewFromURL(cloudinaryURL)
	if err != nil {
		log.Printf("Failed to init Cloudinary: %v", err)
		c.JSON(500, gin.H{"error": "Failed to initialize storage service"})
		return
	}

	form, err := c.MultipartForm()

	log.Println("cloudinaryURL err = ", err)
	if err != nil {
		c.JSON(400, gin.H{"error": "Invalid form data"})
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
			c.JSON(500, gin.H{"error": "Upload failed"})
			return
		}

		log.Println("cloudinaryURL uploadRes.SecureURL = ", uploadRes.SecureURL)
		paths = append(paths, uploadRes.SecureURL)
	}

	c.JSON(200, gin.H{"paths": paths})
}
