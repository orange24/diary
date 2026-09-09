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

	// birthdate is a DATE column — an empty string fails Postgres's date parser,
	// so an omitted birthdate must go in as NULL instead of "".
	var birthdate interface{}
	if user.Birthdate != "" {
		birthdate = user.Birthdate
	}

	query := `INSERT INTO users (
		username, password, full_name, birthdate, gender, country,
		facebook_link, gmail_link, apple_id_link, x_link
	) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`

	_, err := h.DB.Exec(query,
		user.Username, string(hashedPassword), user.FullName, birthdate,
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
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

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

	// เช็ค bcrypt ว่ารหัสผ่านที่ส่งมาตรงกับ hash ในฐานข้อมูลไหม
	if err := bcrypt.CompareHashAndPassword([]byte(dbUser.Password), []byte(input.Password)); err != nil {
		c.JSON(401, gin.H{"error": "Invalid username or password"})
		return
	}

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

// --- ดูโปรไฟล์ตัวเอง ---
func (h *EntryHandler) GetProfile(c *gin.Context) {
	userID := c.MustGet("user_id").(int)

	var u models.User
	query := `SELECT id, username, full_name,
		COALESCE(to_char(birthdate, 'YYYY-MM-DD'), ''), COALESCE(gender, ''), COALESCE(country, ''),
		COALESCE(facebook_link, ''), COALESCE(gmail_link, ''), COALESCE(apple_id_link, ''), COALESCE(x_link, '')
		FROM users WHERE id = $1`

	err := h.DB.QueryRow(query, userID).Scan(
		&u.ID, &u.Username, &u.FullName, &u.Birthdate, &u.Gender, &u.Country,
		&u.FacebookLink, &u.GmailLink, &u.AppleIDLink, &u.XLink,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, u)
}

type UpdateProfileInput struct {
	FullName     string `json:"full_name"`
	Birthdate    string `json:"birthdate"`
	Gender       string `json:"gender"`
	Country      string `json:"country"`
	FacebookLink string `json:"facebook_link"`
	GmailLink    string `json:"gmail_link"`
	AppleIDLink  string `json:"apple_id_link"`
	XLink        string `json:"x_link"`
}

// --- แก้ไขโปรไฟล์ตัวเอง --- (username/password เปลี่ยนที่นี่ไม่ได้ — คนละหน้าที่)
func (h *EntryHandler) UpdateProfile(c *gin.Context) {
	userID := c.MustGet("user_id").(int)

	var input UpdateProfileInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// birthdate is a DATE column — an empty string fails Postgres's date
	// parser, so a cleared birthdate must go in as NULL instead of "".
	var birthdate interface{}
	if input.Birthdate != "" {
		birthdate = input.Birthdate
	}

	query := `UPDATE users SET
		full_name = $1, birthdate = $2, gender = $3, country = $4,
		facebook_link = $5, gmail_link = $6, apple_id_link = $7, x_link = $8
		WHERE id = $9`

	_, err := h.DB.Exec(query,
		input.FullName, birthdate, input.Gender, input.Country,
		input.FacebookLink, input.GmailLink, input.AppleIDLink, input.XLink,
		userID,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Profile updated", "full_name": input.FullName})
}
