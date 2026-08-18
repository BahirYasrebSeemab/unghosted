package admins

import (
	"context"

	"github.com/jackc/pgx/v5/pgxpool"
)

type AdminRepository struct {
	DB *pgxpool.Pool
}

func NewRepository(DB *pgxpool.Pool) *AdminRepository {
	return &AdminRepository{
		DB: DB,
	}
}

func (r *AdminRepository) CheckAdmin(ctx context.Context, data LogInData) (string, error) {
	var password string

	const query = `
		SELECT password FROM admins WHERE email = $1
	`
	err := r.DB.QueryRow(ctx, query, data.Email).Scan(&password)

	if err != nil {
		return "", err
	}

	return password, err
}

func (r *AdminRepository) CheckRefreshToken(refreshToken string) (string, error) {
	ctx := context.Background()
	const query = `
		SELECT email From admin_tokens WHERE admin_token = $1
	`

	var Email string
	err := r.DB.QueryRow(ctx, query, refreshToken).Scan(&Email)

	if err != nil {
		return "", err
	}

	return Email, nil
}

func (r *AdminRepository) AddAdminToken(ctx context.Context, token string, email string) error {
	const query = `
		INSERT INTO admin_tokens (email , admin_token)
		VALUES ($1 , $2)
	`

	_, err := r.DB.Exec(ctx, query, email, token)

	return err
}
