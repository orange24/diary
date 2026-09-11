// internal/middleware/auth.go
package middleware

import (
	"diary_app/backend/internal/apierr"
	"diary_app/backend/internal/utils"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
)

func AuthMiddleware(c *gin.Context) {
	authHeader := c.GetHeader("Authorization")
	if authHeader == "" || !strings.HasPrefix(authHeader, "Bearer ") {
		apierr.JSON(c, http.StatusUnauthorized, apierr.Unauthorized, "Unauthorized")
		c.Abort() // หยุดการทำงานทันที
		return
	}

	tokenStr := strings.TrimPrefix(authHeader, "Bearer ")
	userID, err := utils.ValidateToken(tokenStr)
	if err != nil {
		apierr.JSON(c, http.StatusUnauthorized, apierr.InvalidToken, "Invalid token")
		c.Abort()
		return
	}

	// ฝาก userID ไว้ใน Context ของ Gin
	c.Set("user_id", userID)
	c.Next()
}
