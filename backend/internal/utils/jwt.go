package utils

import (
	"os"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

var API_KEY = os.Getenv("API_KEY")
var secretKey = []byte(API_KEY)

func GenerateToken(userID int) (string, error) {
	claims := jwt.MapClaims{
		"user_id": userID,
		"exp":     time.Now().Add(time.Hour * 24).Unix(), // บัตรมีอายุ 24 ชม.
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString(secretKey)
}

func ValidateToken(tokenStr string) (int, error) {
	token, err := jwt.Parse(tokenStr, func(token *jwt.Token) (interface{}, error) {
		return secretKey, nil
	})
	if err != nil || !token.Valid {
		return 0, err
	}

	claims, ok := token.Claims.(jwt.MapClaims)
	if !ok {
		return 0, err
	}

	userID := int(claims["user_id"].(float64)) // JWT จะเก็บตัวเลขเป็น float64
	return userID, nil
}
