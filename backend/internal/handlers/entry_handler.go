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

// EntryHandler holds the database connection
type EntryHandler struct {
	DB *sql.DB
}

// GetEntries retrieves all diary entries
func (h *EntryHandler) GetEntries(c *gin.Context) {
	// รับค่าจาก query string เช่น /entries?page=1&limit=10
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "10"))
	offset := (page - 1) * limit

	rows, err := h.DB.Query("SELECT id, title, content, created_date, COALESCE(created_by, ''), images FROM entries ORDER BY id DESC LIMIT $1 OFFSET $2", limit, offset)
	if err != nil {
		c.JSON(500, gin.H{"error": err.Error()})
		return
	}
	defer rows.Close()

	var entries []models.Entry
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

func (h *EntryHandler) CreateEntry(c *gin.Context) {
	var input models.Entry
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(400, gin.H{"error": err.Error()})
		return
	}

	// เพิ่มการดึง CreatedAt กลับมาด้วยถ้าต้องการโชว์ทันที
	query := `INSERT INTO entries (title, content, created_by, images) 
			  VALUES ($1, $2, $3, $4) RETURNING id, created_date`

	err := h.DB.QueryRow(query, input.Title, input.Content, input.CreatedBy, pq.Array(input.Images)).Scan(&input.ID, &input.CreatedDate)

	if err != nil {
		c.JSON(500, gin.H{"error": "Failed to create entry: " + err.Error()})
		return
	}
	c.JSON(200, input)
}
func (h *EntryHandler) DeleteEntry(c *gin.Context) {
	id := c.Param("id")
	_, err := h.DB.Exec("DELETE FROM entries WHERE id = $1", id)
	if err != nil {
		c.JSON(500, gin.H{"error": "Failed to delete entry"})
		return
	}
	c.JSON(200, gin.H{"message": "Entry deleted successfully"})
}

func (h *EntryHandler) UpdateEntry(c *gin.Context) {
	id := c.Param("id")
	var input models.Entry // ใช้ model หลักไปเลยจะครอบคลุมกว่า
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(400, gin.H{"error": err.Error()})
		return
	}

	query := `UPDATE entries SET title = $1, content = $2, created_by = $3, images = $4 WHERE id = $5`
	_, err := h.DB.Exec(query, input.Title, input.Content, input.CreatedBy, pq.Array(input.Images), id)
	if err != nil {
		c.JSON(500, gin.H{"error": "Failed to update entry"})
		return
	}
	c.JSON(200, gin.H{"message": "Entry updated successfully"})
}

func (h *EntryHandler) GetEntry(c *gin.Context) {
	id := c.Param("id")
	var e models.Entry

	query := `SELECT id, title, content, created_date, created_by, images FROM entries WHERE id = $1`
	err := h.DB.QueryRow(query, id).Scan(&e.ID, &e.Title, &e.Content, &e.CreatedDate, &e.CreatedBy, pq.Array(&e.Images))

	if err != nil {
		if err == sql.ErrNoRows {
			c.JSON(404, gin.H{"error": "Entry not found"})
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
