package Ourmiddleware

import (
	"context"
	"fmt"
	"go-server/internal/auth"
	"go-server/internal/errors/apierr"
	"net/http"
	"strings"

	"github.com/golang-jwt/jwt/v5"
)

func AuthMiddleware(userService *auth.UserService) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {

			authHeader := r.Header.Get("Authorization")

			if !strings.HasPrefix(authHeader, "Bearer ") {
				http.Error(w, "Unauthorized4", http.StatusUnauthorized)
				return
			}

			tokenString := strings.TrimPrefix(authHeader, "Bearer ")

			email, err := userService.ValidateToken(tokenString)
			if err != nil {
				http.Error(w, "Unauthorized5", http.StatusUnauthorized)
				return
			}

			ctx := context.WithValue(
				r.Context(),
				"Email",
				email,
			)

			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

func ValidateToken(tokenString string, jwtSecret []byte) (string, error) {
	token, err := jwt.Parse(tokenString, func(t *jwt.Token) (any, error) {
		if t.Method != jwt.SigningMethodHS256 {
			return nil, fmt.Errorf("unexpected signing method")
		}

		return jwtSecret, nil
	})

	if err != nil || !token.Valid {
		return "", apierr.Unauthorized(
			"Invalid or expired JWT token",
			err,
		)
	}

	claims, ok := token.Claims.(jwt.MapClaims)
	if !ok {
		return "", apierr.Unauthorized(
			"Invalid token claims",
			nil,
		)
	}

	sub, ok := claims["sub"].(string)
	if !ok || sub == "" {
		return "", apierr.Unauthorized(
			"Invalid token subject",
			nil,
		)
	}

	return sub, nil
}
