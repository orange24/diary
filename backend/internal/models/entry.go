package models

// Entry represents the diary record structure
type Entry struct {
	ID      int    `json:"id"`
	Title   string `json:"title"`
	Content string `json:"content"`
}