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

	if err = db.Ping(); err != nil {
		log.Fatal("Cannot connect to DB:", err)
	}

	log.Println("Database connected successfully!")
	return db
}