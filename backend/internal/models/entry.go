package models

type Entry struct {
	ID          int      `json:"id"`
	Title       string   `json:"title"`
	Content     string   `json:"content"`
	CreatedDate string   `json:"created_date"`
	CreatedBy   string   `json:"created_by"`
	Images      []string `json:"images"`
}
