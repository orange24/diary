package config

import (
	"fmt"
	"log"
	"os"

	"github.com/joho/godotenv"
)

type Config struct {
	DB_URL        string
	CloudinaryURL string
	Port          string
}

func LoadConfig() *Config {
	// โหลด .env แบบไม่บังคับ (ถ้าไม่มีก็ไม่เป็นไร)
	_ = godotenv.Load()

	var connStr string

	if os.Getenv("DATABASE_URL") != "" {
		connStr = os.Getenv("DATABASE_URL")
	} else {
		host := getEnv("DB_HOST", "localhost")
		port := getEnv("DB_PORT", "5432")
		user := getEnv("DB_USER", "postgres")
		pass := getEnv("DB_PASSWORD", "password")
		name := getEnv("DB_NAME", "diary_db")

		log.Println("DB_HOST: %s", host)
		log.Println("DB_PORT: %s", port)
		log.Println("DB_USER: %s", user)
		log.Println("DB_NAME: %s", name)

		connStr = fmt.Sprintf("host=%s port=%s user=%s password=%s dbname=%s sslmode=disable",
			host, port, user, pass, name)
	}

	return &Config{
		DB_URL:        connStr,
		CloudinaryURL: os.Getenv("CLOUDINARY_URL"),
		Port:          getEnv("PORT", "8080"), // รองรับ Port ของ GCP
	}
}

// ฟังก์ชันช่วยดึงค่า Env ถ้าไม่มีให้ใช้ค่า Default
func getEnv(key, fallback string) string {
	if value, ok := os.LookupEnv(key); ok {
		return value
	}
	return fallback
}
