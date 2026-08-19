package auth

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

var ErrRefreshTokenNotFound = errors.New("refresh token not found")

type UserRepository struct {
	DB *pgxpool.Pool
}

func NewRepository(DB *pgxpool.Pool) *UserRepository {
	return &UserRepository{
		DB: DB,
	}
}

func (r *UserRepository) CreateUser(ctx context.Context, user User) error {
	fmt.Println(user.Name, " ", user.Email, " ", user.Password, " ", user.Companies)

	_, err := r.DB.Exec(ctx, `INSERT INTO users
		(name, email , password , companies)
		VALUES ($1 , $2 , $3 , $4)
	`, user.Name, user.Email, user.Password, user.Companies)

	if err != nil {
		return err
	}

	_, err = r.DB.Exec(ctx, `DELETE FROM temp_users WHERE email = $1`, user.Email)

	if err != nil {
		return err
	}

	return nil
}

// Registration consists of two parts:
// CreatingTempUser -> Sending code to gmail
// -> Creating real user

func (r *UserRepository) CreateTempUser(tempUser TempUser) error {
	ctx := context.Background()

	var Email string
	err := r.DB.QueryRow(ctx,
		`SELECT email FROM temp_users WHERE email = $1`, tempUser.Email).
		Scan(&Email)
	if err != nil && !errors.Is(err, pgx.ErrNoRows) {
		return err
	}

	if Email != "" {
		return errors.New("We already send the code")
	}

	Email = ""

	err = r.DB.QueryRow(ctx,
		`SELECT email FROM users WHERE email = $1`, tempUser.Email).
		Scan(&Email)

	if err != nil && !errors.Is(err, pgx.ErrNoRows) {
		return err
	}

	if Email != "" {
		return errors.New("User with this data already exists")
	}

	_, err = r.DB.Exec(ctx, `INSERT INTO temp_users
		(name , email , code , password , finish_time)
		VALUES ($1 , $2 , $3 , $4 , $5)
	`, tempUser.Name, tempUser.Email, tempUser.Code, tempUser.Password, tempUser.Finish_time)

	if err != nil {
		return err
	}
	return nil
}

func (r *UserRepository) FindCode(ConfirmEmail string) (int, error) {
	ctx := context.Background()

	var Code int

	err := r.DB.QueryRow(ctx,
		`SELECT code FROM temp_users WHERE email = $1`, ConfirmEmail).
		Scan(&Code)

	if err != nil && !errors.Is(err, pgx.ErrNoRows) {
		return 0, err
	}

	if Code == 0 {
		return 0, errors.New("User with this data already doesn`t exist")
	}

	return Code, nil
}

// Search user in database by email
// No user with such email -> empty User, err
// Found -> return found user (type User)
func (r *UserRepository) GetUsersData(ctx context.Context, UserEmail string) (*User, error) {
	var user User

	err := r.DB.QueryRow(ctx,
		`SELECT name, email , password FROM temp_users WHERE email = $1`, UserEmail).
		Scan(&user.Name, &user.Email, &user.Password)

	if err != nil {
		return &User{}, err
	}

	return &user, nil
}

func (r *UserRepository) GetRealUser(ctx context.Context, UserEmail string) (User, error) {
	var user User

	err := r.DB.QueryRow(ctx,
		`SELECT name, email, password FROM users WHERE email = $1`, UserEmail).
		Scan(&user.Name, &user.Email, &user.Password)

	if err != nil {
		return User{}, err
	}

	return user, nil
}

// func (r *UserRepository) Login(userEmail, refreshToken string) (error) {=
// 	ctx := contextcontext.Background()
//
// 	var user User
//
// 	err := r.DB.QueryRow
// }

func (r *UserRepository) StoreRefreshToken(ctx context.Context, email string, tokenHash string, expiresAt time.Time) error {
	const query = `
		INSERT INTO refresh_tokens(email, token_hash, expires_at)
		VALUES ($1, $2, $3)`

	_, err := r.DB.Exec(ctx, query, email, tokenHash, expiresAt)
	return err
}

func (r *UserRepository) GetRefreshToken(ctx context.Context, tokenHash string) (*RefreshToken, error) {
	const query = `
		SELECT id, email, token_hash, expires_at, revoked_at, created_at
		FROM refresh_tokens
		WHERE token_hash = $1
	`

	var rt RefreshToken
	err := r.DB.QueryRow(ctx, query, tokenHash).
		Scan(&rt.ID, &rt.Email, &rt.TokenHash, &rt.ExpiresAt, &rt.RevokedAt, &rt.CreatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrRefreshTokenNotFound
	}

	if err != nil {
		return nil, err
	}

	return &rt, nil
}

func (r *UserRepository) LogOut(ctx context.Context, tokenHash string) error {
	const query = `
		DELETE FROM refresh_tokens WHERE token_hash = $1
	`

	_, err := r.DB.Exec(ctx, query, tokenHash)
	return err
}
