package database

import (
	"database/sql"
	"log"

	_ "github.com/lib/pq"
)

func ConnectDB(connStr string) *sql.DB {
	db, err := sql.Open("postgres", connStr)
	if err != nil {
		log.Fatal(err)
	}

	err = db.Ping()
	if err != nil {
		log.Printf("❌ Database Connection Error: %v", err)
	} else {
		log.Println("✅ Database Connected Successfully!")
	}

	return db
}
