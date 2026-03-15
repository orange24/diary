package main

import (
	"diary_app/backend/config"
	"diary_app/backend/internal/database"
	"diary_app/backend/internal/handlers"
	"log"
	"os" // Don't forget to import "os"

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

	// 3. Setup Routes
	r := gin.Default()

	// Configure CORS: Allow requests from the frontend (usually port 3000)
	r.Use(cors.Default())

	r.GET("/entries", entryHandler.GetEntries)
	r.POST("/entries", entryHandler.CreateEntry)
	r.DELETE("/entries/:id", entryHandler.DeleteEntry)
	r.PUT("/entries/:id", entryHandler.UpdateEntry)
	r.GET("/entries/:id", entryHandler.GetEntry)
	// Add other routes here later...

	os.MkdirAll("./uploads", os.ModePerm)
	r.Static("/uploads", "./uploads")

	r.POST("/upload", entryHandler.UploadFiles) // API ใหม่สำหรับอัปโหลด

	// 4. Get port from environment variable, default to 9090
	port := os.Getenv("API_PORT")
	log.Println("port = ", port)
	if port == "" {
		port = "9090"
	}

	// Start server
	r.Run(":" + port)
}
