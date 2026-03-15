package handlers

import (
	"database/sql"
	"diary_app/backend/internal/models"
	"fmt"
	"net/http"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/lib/pq"
)

type EntryHandler struct {
	DB *sql.DB
}

// 1. GetEntries: ดึงเฉพาะของตัวเอง
func (h *EntryHandler) GetEntries(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "10"))
	offset := (page - 1) * limit

	// ดึง userID จาก Middleware (ที่เก็บไว้ใน Context ของ Gin)
	userID := c.MustGet("user_id")

	// เพิ่มเงื่อนไข WHERE user_id = $3
	query := `SELECT id, title, content, created_date, COALESCE(created_by, ''), images 
			  FROM entries 
			  WHERE user_id = $3 
			  ORDER BY id DESC LIMIT $1 OFFSET $2`

	rows, err := h.DB.Query(query, limit, offset, userID)
	if err != nil {
		c.JSON(500, gin.H{"error": err.Error()})
		return
	}
	defer rows.Close()

	var entries []models.Entry = []models.Entry{} // ป้องกันการส่ง null กลับไปถ้าไม่มีข้อมูล
	for rows.Next() {
		var e models.Entry
		err := rows.Scan(&e.ID, &e.Title, &e.Content, &e.CreatedDate, &e.CreatedBy, pq.Array(&e.Images))
		if err != nil {
			c.JSON(500, gin.H{"error": "Scan error: " + err.Error()})
			return
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

	// เพิ่ม user_id ลงใน INSERT query
	query := `INSERT INTO entries (title, content, created_by, images, user_id) 
              VALUES ($1, $2, $3, $4, $5) RETURNING id, created_date`

	err := h.DB.QueryRow(query, input.Title, input.Content, input.CreatedBy, pq.Array(input.Images), userID).
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

	query := `UPDATE entries SET title = $1, content = $2, created_by = $3, images = $4 
			  WHERE id = $5 AND user_id = $6`
	res, err := h.DB.Exec(query, input.Title, input.Content, input.CreatedBy, pq.Array(input.Images), id, userID)

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

	query := `SELECT id, title, content, created_date, created_by, images 
			  FROM entries WHERE id = $1 AND user_id = $2`
	err := h.DB.QueryRow(query, id, userID).
		Scan(&e.ID, &e.Title, &e.Content, &e.CreatedDate, &e.CreatedBy, pq.Array(&e.Images))

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
	// 1. จำกัดขนาดไฟล์รวม (เช่น 100MB)
	c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, 100<<20)

	form, err := c.MultipartForm()
	if err != nil {
		c.JSON(400, gin.H{"error": "File too large (Max 100MB)"})
		return
	}

	files := form.File["media"]
	var paths []string

	for _, file := range files {
		// เช็คขนาดไฟล์รายชิ้น (เช่น 50MB)
		if file.Size > 50<<20 {
			c.JSON(400, gin.H{"error": "Single file size must be less than 50MB"})
			return
		}

		filename := fmt.Sprintf("%d-%s", time.Now().UnixNano(), file.Filename)
		path := "uploads/" + filename

		if err := c.SaveUploadedFile(file, path); err != nil {
			c.JSON(500, gin.H{"error": "Save error"})
			return
		}

		// 2. ถ้าเป็นวิดีโอ ให้ใช้ ffmpeg ตัดรูป Thumbnail
		ext := strings.ToLower(filepath.Ext(filename))
		if ext == ".mp4" || ext == ".mov" || ext == ".webm" {
			thumbName := "thumb-" + filename + ".jpg"
			thumbPath := "uploads/" + thumbName

			// รันคำสั่ง ffmpeg: ตัดวินาทีที่ 1 มา 1 รูป
			cmd := exec.Command("ffmpeg", "-i", path, "-ss", "00:00:01", "-vframes", "1", thumbPath)
			if err := cmd.Run(); err == nil {
				// เราจะเก็บชื่อไฟล์ thumbnail ไว้คู่กับวิดีโอ หรือส่งกลับไปให้ Frontend รู้
				// ในที่นี้ขอส่งแค่ path วิดีโอ แต่ Frontend จะรู้เองว่ามี thumb- นำหน้า
			}
		}

		paths = append(paths, "/"+path)
	}
	c.JSON(200, gin.H{"paths": paths})
}
