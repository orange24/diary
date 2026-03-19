package handlers

import (
	"database/sql"
	"diary_app/backend/internal/models"
	"log"
	"os"
	"strconv"

	"github.com/cloudinary/cloudinary-go/v2"
	"github.com/cloudinary/cloudinary-go/v2/api/uploader"
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
		err := rows.Scan(&e.ID, &e.Title, &e.Content, &e.CreatedDate, &e.CreatedBy, &e.Images)
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
		Scan(&e.ID, &e.Title, &e.Content, &e.CreatedDate, &e.CreatedBy, &e.Images)

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
