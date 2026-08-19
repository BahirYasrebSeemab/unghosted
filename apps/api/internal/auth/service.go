package auth

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"go-server/internal/errors/apierr"
	"go-server/internal/pkg/hashing"
	"math/big"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"gopkg.in/gomail.v2"
)

type UserService struct {
	repo                 *UserRepository
	JWTSecret            []byte
	jwtRefreshExpiration time.Duration
	jwtAccessExpiration  time.Duration
}

func NewUserService(repo *UserRepository, jwtSecret string, jwtAccessExpiration time.Duration, jwtRefreshExpiration time.Duration) *UserService {
	return &UserService{
		repo:                 repo,
		JWTSecret:            []byte(jwtSecret),
		jwtAccessExpiration:  jwtAccessExpiration,
		jwtRefreshExpiration: jwtRefreshExpiration,
	}
}

func (s *UserService) CreateUser(ctx context.Context, ConfirmMessage ConfirmMessage) error {
	Code, err := s.repo.FindCode(ConfirmMessage.Email)
	if err != nil {
		return err
	}

	if Code != ConfirmMessage.Code {
		return errors.New("Incorrect confirmation Code")
	}

	UserData, err := s.repo.GetUsersData(ctx, ConfirmMessage.Email)
	UserData.Companies = []string{}
	return s.repo.CreateUser(ctx, *UserData)
}

func (s *UserService) CreateTempUser(NotReadyUser NotReadyUser) error {
	var tempUser TempUser

	hashed_password, err := hashing.CreateHash(NotReadyUser.Password)

	if err != nil {
		return err
	}

	n, err := rand.Int(rand.Reader, big.NewInt(900000))
	if err != nil {
		return err
	}
	code := n.Int64() + 100000

	now := time.Now()
	_ = now.Add(10 * time.Minute)
	// if err != nil {
	// 	return err
	// }
	//
	tempUser.Email = NotReadyUser.Email
	tempUser.Name = NotReadyUser.Name
	tempUser.Password = hashed_password
	tempUser.Code = int(code)
	tempUser.Finish_time = now

	mail_message := fmt.Sprintf(
		"Hello %s from LCC\n here is you app verification code: %v", tempUser.Name, code,
	)

	m := gomail.NewMessage()
	m.SetHeader("From", "app75490@gmail.com")
	m.SetHeader("To", tempUser.Email)
	m.SetHeader("Subject", "App verifycation")
	m.SetBody("text/html", fmt.Sprintf(`<h1 class="header" style = "color:blue">%s</h1>`, mail_message))

	send := gomail.NewDialer("smtp.gmail.com", 587, "app75490@gmail.com", "znvh weto comb wkkd ")
	err = send.DialAndSend(m)
	if err != nil {
		return err
	}

	return s.repo.CreateTempUser(tempUser)
}

func (s *UserService) Login(ctx context.Context, loginRequest LogInData) (*AuthResponse, error) {
	// Compare arg email with db email
	usr, err := s.repo.GetRealUser(ctx, loginRequest.Email)
	LogInErr := errors.New("Invalid credentials")

	if err != nil {
		// return nil, apierr.Unauthorized("Invalid credentials 1", err)
		return nil, apierr.Unauthorized("Didn't find such row", LogInErr)
	}

	ok, err := hashing.ValidateHash(loginRequest.Password, usr.Password)

	if err != nil {
		return nil, apierr.Unauthorized("Invalid credentials", err)
	}

	if !ok {
		return nil, apierr.Unauthorized("invalid credentials 2", LogInErr)
	}

	// hashedEmail, err := hashing.CreateHash(loginRequest.Email)
	//
	// if err != nil {
	// 	return nil, fmt.Errorf("Error hashing email")
	// }

	accessTokenString, err := s.issueToken(loginRequest.Email)
	fmt.Print("JWT TOKENS created!!", accessTokenString)

	if err != nil {
		return nil, apierr.Internal(err)
	}

	refreshTokenRaw, refreshTokenHash, err := s.generateRefreshToken()

	if err != nil {
		return nil, apierr.Internal(err)
	}

	if err := s.repo.StoreRefreshToken(ctx, usr.Email, refreshTokenHash, time.Now().Add(s.jwtRefreshExpiration)); err != nil {
		return nil, apierr.Internal(err)
	}

	return &AuthResponse{
		Token:        accessTokenString,
		RefreshToken: refreshTokenRaw,
		User:         usr,
	}, nil

}

func (s *UserService) issueToken(cachedMessage string) (string, error) {
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

func (s *UserService) ValidateToken(tokenString string) (email string, err error) {
	token, err := jwt.Parse(tokenString, func(t *jwt.Token) (any, error) {
		return s.JWTSecret, nil
	})

	if err != nil || !token.Valid {
		return "", apierr.Unauthorized("Invalid or expired JWT token", err)
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

func (s *UserService) generateRefreshToken() (raw string, hash string, err error) {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return "", "", err
	}

	raw = hex.EncodeToString(b)
	sum := sha256.Sum256([]byte(raw))
	hash = hex.EncodeToString(sum[:])
	return raw, hash, nil
}

func (s *UserService) Refresh(ctx context.Context, rawToken string) (string, error) {
	sum := sha256.Sum256([]byte(rawToken))
	hash := hex.EncodeToString(sum[:])

	stored, err := s.repo.GetRefreshToken(ctx, hash)
	if errors.Is(err, ErrRefreshTokenNotFound) {
		return "", apierr.Unauthorized("invalid refresh token", nil)
	}

	if err != nil {
		return "", apierr.Internal(err)
	}

	if stored.RevokedAt != nil {
		return "", apierr.Unauthorized("Refresh token has been revoked", nil)
	}

	if time.Now().After(stored.ExpiresAt) {
		return "", apierr.Unauthorized("refresh token has expired", nil)
	}

	hashedEmail, err := hashing.CreateHash(stored.Email)
	if err != nil {
		return "", apierr.Internal(err)
	}

	newAccessToken, err := s.issueToken(hashedEmail)
	if err != nil {
		return "", apierr.Internal(err)
	}

	return newAccessToken, nil
}

func (s *UserService) LogOut(ctx context.Context, rawToken string) error {
	sum := sha256.Sum256([]byte(rawToken))
	hash := hex.EncodeToString(sum[:])

	err := s.repo.LogOut(ctx, hash)
	return err
}
