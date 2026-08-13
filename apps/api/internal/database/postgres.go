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
			Name TEXT NOT NULL,
			Email TEXT NOT NULL PRIMARY KEY,
			Code INT NOT NULL,
			Password TEXT NOT NULL,
			Finish_time TIMESTAMPTZ
		)
	`)
	
	if err != nil {
		log.Fatal(err)
	}
	// Add refesh token to the users
	_, err = pool.Exec(ctx, `
		CREATE TABLE IF NOT EXISTS users(
			Name TEXT NOT NULL,
			Email TEXT NOT NULL PRIMARY KEY,
			Password TEXT NOT NULL,
			RefreshToken TEXT,
			Companies TEXT[]
		)
	`)

	if err != nil {
		log.Fatal(err)
	}

	_, err = pool.Exec(ctx, `
		CREATE TABLE IF NOT EXISTS Companies(
			Name TEXT NOT NULL PRIMARY KEY,
			Owner TEXT NOT NULL,
			Admins TEXT[],
			Hrs TEXT[],
			Balance INT
		)
	`)

	if err != nil {
		log.Fatal(err)
	}

	_, err = pool.Exec(ctx, `
		CREATE TABLE IF NOT EXISTS refresh_tokens(
			Id 			UUID NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
			Email		TEXT NOT NULL,
			Token_hash	TEXT NOT NULL UNIQUE,
			Expires_at 	TIMESTAMPTZ NOT NULL,
			Revoked_at 	TIMESTAMPTZ,
			Created_at 	TIMESTAMPTZ NOT NULL DEFAULT now()
		)
	`)

	if err != nil {
		log.Fatal(err)
	}

	return pool, nil
}
