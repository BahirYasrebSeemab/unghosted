package db

import (
	"context"
	"fmt"
	"time"

	"os"

	_ "github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/joho/godotenv"

	"log"
)

func NewPostgresPool(ctx context.Context) (*pgxpool.Pool, error) {
	if err := godotenv.Load(); err != nil {
		log.Fatal("No config found")
	}
	dsn := fmt.Sprintf(
		"postgres://%s:%s@%s:%s/%s?sslmode=%s",
		os.Getenv("POSTGRES_USER"),
		os.Getenv("POSTGRES_PASSWORD"),
		os.Getenv("POSTGRES_HOST"),
		os.Getenv("POSTGRES_PORT"),
		os.Getenv("POSTGRES_DB"),
		os.Getenv("POSTGRES_SSLMODE"),
	)

	poolCfg, err := pgxpool.ParseConfig(dsn)
	if err != nil {
		return nil, fmt.Errorf("parsing database url: %w", err)
	}

	poolCfg.MaxConns = 10
	poolCfg.MinConns = 2
	poolCfg.MaxConnLifetime = time.Hour
	poolCfg.MaxConnIdleTime = 30 * time.Minute

	pool, err := pgxpool.NewWithConfig(ctx, poolCfg)
	if err != nil {
		return nil, fmt.Errorf("Creating pool connection: %w", err)
	}

	pingCtx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	if err := pool.Ping(pingCtx); err != nil {
		pool.Close()
		return nil, fmt.Errorf("pinging database: %w", err)
	}

	_, err = pool.Exec(ctx, `
		CREATE TABLE IF NOT EXISTS temp_users(
			name TEXT NOT NULL,
			email TEXT NOT NULL PRIMARY KEY,
			code INT NOT NULL,
			password TEXT NOT NULL,
			finish_time TIMESTAMPTZ
		)
	`)

	if err != nil {
		log.Fatal(err)
	}
	// Add refesh token to the users
	_, err = pool.Exec(ctx, `
		CREATE TABLE IF NOT EXISTS users(
			name TEXT NOT NULL,
			email TEXT NOT NULL PRIMARY KEY,
			password TEXT NOT NULL,
			refreshToken TEXT,
			companies TEXT[]
		)
	`)

	if err != nil {
		log.Fatal(err)
	}

	_, err = pool.Exec(ctx, `
		CREATE TABLE IF NOT EXISTS Companies(
			id SERIAL PRIMARY KEY,
			name TEXT NOT NULL,
			owner TEXT NOT NULL,
			admins TEXT[],
			hrs TEXT[],
			balance INT
		)
	`)

	if err != nil {
		log.Fatal(err)
	}

	_, err = pool.Exec(ctx, `
		CREATE TABLE IF NOT EXISTS refresh_tokens(
			id 			UUID NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
			email		TEXT NOT NULL,
			token_hash	TEXT NOT NULL UNIQUE,
			expires_at 	TIMESTAMPTZ NOT NULL,
			revoked_at 	TIMESTAMPTZ,
			created_at 	TIMESTAMPTZ NOT NULL DEFAULT now()
		)
	`)

	if err != nil {
		log.Fatal(err)
	}

	return pool, nil
}
