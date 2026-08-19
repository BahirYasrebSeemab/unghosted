package admins

import (
	"context"
	"net/http"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

type AdminService struct {
	repo                 *AdminRepository
	JWTSecret            []byte
	jwtRefreshExpiration time.Duration
	jwtAccessExpiration  time.Duration
}

func NewAdminService(repo *AdminRepository, jwtSecret string, jwtAccessExpiration time.Duration, jwtRefreshExpiration time.Duration) *AdminService {
	return &AdminService{
		repo:                 repo,
		JWTSecret:            []byte(jwtSecret),
		jwtAccessExpiration:  jwtAccessExpiration,
		jwtRefreshExpiration: jwtRefreshExpiration,
	}
}

func (s *AdminService) CheckAdmin(ctx context.Context, data LogInData) (string, bool, error) {
	password, err := s.repo.CheckAdmin(ctx, data)

	if err != nil {
		return "", false, err
	}

	if password == "" {
		return "", false, err
	}

	if data.Password != password {
		return "", false, nil
	}

	admin_token, err := s.issueToken(data.Email)

	if err != nil {
		return "", false, err
	}

	err = s.repo.AddAdminToken(ctx, admin_token, data.Email)

	if err != nil {
		return "", false, err
	}

	return admin_token, true, nil
}

func (s *AdminService) issueToken(cachedMessage string) (string, error) {
	claimsAccessToken := jwt.MapClaims{
		"sub": cachedMessage,
		"exp": time.Now().Add(s.jwtAccessExpiration).Unix(),
		"iat": time.Now().Unix(),
	}

	accessToken := jwt.NewWithClaims(jwt.SigningMethodHS256, claimsAccessToken)

	// refreshToken := jwt.NewWithClaims(jwt.SigningMethodHS256, claimsRefreshToken)

	accessTokenString, err := accessToken.SignedString(s.JWTSecret)

	if err != nil {
		return "", err
	}

	return accessTokenString, nil
}

func (s *AdminService) AdminMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {

		cookie, err := r.Cookie("refresh_token")
		if err != nil {
			http.Error(w, "Refresh token not found", http.StatusUnauthorized)
			return
		}

		email, err := s.repo.CheckRefreshToken(cookie.Value)
		if err != nil {
			http.Error(w, "Invalid refresh token", http.StatusUnauthorized)
			return
		}

		// Передаем email дальше
		ctx := context.WithValue(
			r.Context(),
			"Email",
			email,
		)

		next.ServeHTTP(w, r.WithContext(ctx))
	})
}
