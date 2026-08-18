package middleware

import (
	"context"
	"fmt"
	"go-server/internal/auth"
	"go-server/internal/errors/apierr"
	"net/http"
	"strings"

	"log/slog"
	_ "log/slog"

	"github.com/golang-jwt/jwt/v5"
)

// func AuthMiddleware(next http.Handler) http.Handler {
// 	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
// 		var ctx context.Context;
// 		// TODO: not only check token in json, but ?token=... URL param as weel
// 		authHeader := r.Header.Get("Authorization")
//
// 		// Authorization: "Bearer <token>"
// 		tokenString := strings.TrimPrefix(authHeader, "Bearer ")
//
// 		if tokenString == "" {
// 			tokenString = r.URL.Query().Get("token")
// 		}
//
// 		email, err := ValidateToken(tokenString)
//
// 		if err != nil {
// 			http.Error(w, "Unauthorized: invalid token", http.StatusUnauthorized)
// 			return
// 		}
//
// 		// error getting from headers and empty ?token=...
// 		slog.Log(ctx, slog.LevelInfo, "TOKEN"+r.URL.Query().Get("token"))
//
// 		// например, передаем userID дальше
// 		ctx = context.WithValue(
// 			r.Context(),
// 			"Email",
// 			email,
// 		)
//
// 		next.ServeHTTP(w, r.WithContext(ctx))
// 	})
// }

// func ValidateToken(tokenString string) (email string, err error) {
// 	if err := godotenv.Load(); err != nil {
// 		slog.Warn("no .env file found, using existing environment", "error", err)
// 	}
//
// 	cfg, err := config.Load()
// 	if err != nil {
// 		return "", err
// 	}
//
// 	token, err := jwt.Parse(tokenString, func(t *jwt.Token) (any, error) {
// 		return []byte(cfg.JWTSecret), nil
// 	})
//
// 	if err != nil || !token.Valid {
// 		return "", apierr.Unauthorized("Invalid or expired JWT token", err)
// )

func AuthMiddleware(userService *auth.UserService) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {

			authHeader := r.Header.Get("Authorization")
			
			slog.Log(r.Context(), slog.LevelInfo, "your url token is:"+r.URL.Query().Get("token"))
			if !strings.HasPrefix(authHeader, "Bearer ") && r.URL.Query().Get("token") == "" {
				http.Error(w, "Unauthorized4", http.StatusUnauthorized)
				return
			}

			tokenString := strings.TrimPrefix(authHeader, "Bearer ")
			if tokenString == "" {
				tokenString = r.URL.Query().Get("token")
			}

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
		return "", apierr.Unauthorized("Invalid token claims", nil)
	}

	sub, ok := claims["sub"].(string)
	if !ok || sub == "" {
		return "", apierr.Unauthorized("Invalid token subject", nil)
	}

	return sub, nil
}
