package config

import (
	"log"
	"os"

	"github.com/joho/godotenv"
)

type Config struct {
	DB_URL string
}

func LoadConfig() *Config {
	err := godotenv.Load()
	if err != nil {
		log.Fatal("Error loading .env file")
	}

	// สร้าง Connection String จากตัวแปรใน .env
	connStr := "host=" + os.Getenv("DB_HOST") +
		" port=" + os.Getenv("DB_PORT") +
		" user=" + os.Getenv("DB_USER") +
		" password=" + os.Getenv("DB_PASSWORD") +
		" dbname=" + os.Getenv("DB_NAME") +
		" sslmode=disable"

	return &Config{DB_URL: connStr}
}
