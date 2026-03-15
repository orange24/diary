package handlers

import (
	"diary_app/backend/internal/models"
	"diary_app/backend/internal/utils"
	"net/http"

	"log"

	"github.com/gin-gonic/gin"
	"golang.org/x/crypto/bcrypt"
)

// --- สมัครสมาชิก ---
func (h *EntryHandler) Register(c *gin.Context) {
	var user models.User
	if err := c.ShouldBindJSON(&user); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	hashedPassword, _ := bcrypt.GenerateFromPassword([]byte(user.Password), 10)

	query := `INSERT INTO users (
		username, password, full_name, birthdate, gender, country, 
		facebook_link, gmail_link, apple_id_link, x_link
	) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`

	_, err := h.DB.Exec(query,
		user.Username, string(hashedPassword), user.FullName, user.Birthdate,
		user.Gender, user.Country, user.FacebookLink, user.GmailLink,
		user.AppleIDLink, user.XLink,
	)

	if err != nil {
		c.JSON(http.StatusConflict, gin.H{"error": "Registration failed"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Register success"})
}

// --- เข้าสู่ระบบ ---
func (h *EntryHandler) Login(c *gin.Context) {
	var input models.User
	if err := c.ShouldBindJSON(&input); err != nil {
		log.Printf("Error binding JSON: %v", err) // ดูว่า JSON ส่งมาผิด format ไหม
		return
	}

	log.Printf("Login attempt for username: %s", input.Username)

	var dbUser models.User
	// 1. เพิ่ม username และ full_name เข้าไปใน Query
	query := "SELECT id, username, full_name, password FROM users WHERE username = $1"
	err := h.DB.QueryRow(query, input.Username).Scan(
		&dbUser.ID,
		&dbUser.Username,
		&dbUser.FullName,
		&dbUser.Password,
	)

	if err != nil {
		c.JSON(401, gin.H{"error": "Invalid username or password"})
		return
	}

	// ... code check bcrypt ...

	token, err := utils.GenerateToken(dbUser.ID)
	if err != nil {
		c.JSON(500, gin.H{"error": "Could not generate token"})
		return
	}

	// 2. ตอนนี้ dbUser จะมีข้อมูลครบพร้อมส่งแล้วครับ
	c.JSON(http.StatusOK, gin.H{
		"token":     token,
		"userId":    dbUser.ID,
		"username":  dbUser.Username,
		"full_name": dbUser.FullName,
	})
}
