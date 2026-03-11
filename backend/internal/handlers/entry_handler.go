package handlers

import (
	"database/sql"
	"diary_app/backend/internal/models"
	"net/http"

	"github.com/gin-gonic/gin"
)

// EntryHandler holds the database connection
type EntryHandler struct {
	DB *sql.DB
}

// GetEntries retrieves all diary entries
func (h *EntryHandler) GetEntries(c *gin.Context) {
	rows, err := h.DB.Query("SELECT id, title, content FROM entries")
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer rows.Close()

	var entries []models.Entry
	for rows.Next() {
		var e models.Entry
		if err := rows.Scan(&e.ID, &e.Title, &e.Content); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		entries = append(entries, e)
	}

	c.JSON(http.StatusOK, entries)
}

// CreateEntry inserts a new diary entry
func (h *EntryHandler) CreateEntry(c *gin.Context) {
	var e models.Entry
	if err := c.BindJSON(&e); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
		return
	}

	_, err := h.DB.Exec("INSERT INTO entries (title, content) VALUES ($1, $2)", e.Title, e.Content)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"message": "Entry created successfully"})
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
	var input struct {
		Title   string `json:"title"`
		Content string `json:"content"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(400, gin.H{"error": err.Error()})
		return
	}

	_, err := h.DB.Exec("UPDATE entries SET title = $1, content = $2 WHERE id = $3", input.Title, input.Content, id)
	if err != nil {
		c.JSON(500, gin.H{"error": "Failed to update entry"})
		return
	}
	c.JSON(200, gin.H{"message": "Entry updated successfully"})
}

func (h *EntryHandler) GetEntry(c *gin.Context) {
	id := c.Param("id")
	var entry struct {
		ID      int    `json:"id"`
		Title   string `json:"title"`
		Content string `json:"content"`
	}

	err := h.DB.QueryRow("SELECT id, title, content FROM entries WHERE id = $1", id).Scan(&entry.ID, &entry.Title, &entry.Content)
	if err != nil {
		c.JSON(404, gin.H{"error": "Entry not found"})
		return
	}
	c.JSON(200, entry)
}
