package main

import (
	"diary_app/backend/config"
	"diary_app/backend/internal/database"
	"diary_app/backend/internal/handlers"
	"diary_app/backend/internal/middleware"
	"log"
	"os"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
)

func main() {
	// 1. Load config and DB
	cfg := config.LoadConfig()
	db := database.ConnectDB(cfg.DB_URL)
	defer db.Close()

	// 2. Initialize handlers with DB
	entryHandler := &handlers.EntryHandler{DB: db}

	// 3. Setup Router (ใช้ Gin ทั้งหมด)
	r := gin.Default()

	// Configure CORS
	r.Use(cors.New(cors.Config{
		AllowOrigins:     []string{"http://localhost:3000"}, // URL ของ Next.js
		AllowMethods:     []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Authorization"},
		ExposeHeaders:    []string{"Content-Length"},
		AllowCredentials: true,
	}))

	// เตรียมโฟลเดอร์ Uploads
	os.MkdirAll("./uploads", os.ModePerm)
	r.Static("/uploads", "./uploads")

	// --- Public Routes (ไม่ต้องล็อกอิน) ---
	r.POST("/register", entryHandler.Register)
	r.POST("/login", entryHandler.Login)

	// --- Protected Routes (ต้องมี JWT Token) ---
	// เราจะใช้ Group ของ Gin เพื่อให้ Middleware ครอบคลุมเฉพาะกลุ่มนี้
	authorized := r.Group("/")
	authorized.Use(func(c *gin.Context) {
		// แปลง Middleware มาตรฐานให้เข้ากับ Gin
		// หรือถ้าคุณแก้ middleware/auth.go เป็นแบบ Gin แล้ว ให้ใส่ตรงนี้ได้เลย
		middleware.AuthMiddleware(c)
	})
	{
		authorized.GET("/entries", entryHandler.GetEntries)
		authorized.POST("/entries", entryHandler.CreateEntry)
		authorized.DELETE("/entries/:id", entryHandler.DeleteEntry)
		authorized.PUT("/entries/:id", entryHandler.UpdateEntry)
		authorized.GET("/entries/:id", entryHandler.GetEntry)
		authorized.POST("/upload", entryHandler.UploadFiles)
	}

	// 4. Start server
	port := os.Getenv("API_PORT")
	if port == "" {
		port = "9090"
	}
	log.Println("Server running on port:", port)
	r.Run(":" + port)
}
