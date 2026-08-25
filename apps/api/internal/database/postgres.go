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
	// .env lives at the repo root, but this is called from apps/api (cmd/server, cmd/seedadmin,
	// ...) — apps/api's parent is apps/, not the repo root, so it's two levels up from here.
	// Try the local dir first, then that, before giving up. Non-fatal either way: the vars may
	// already be set in the process environment (CI, docker, etc.).
	if err := godotenv.Load(); err != nil {
		if err := godotenv.Load("../../.env"); err != nil {
			log.Println("no .env file found in this directory or two levels up — using existing environment variables")
		}
	}
	// dsn := fmt.Sprintf(
	// 	"postgres://%s:%s@%s:%s/%s?sslmode=%s",
	// 	os.Getenv("POSTGRES_USER"),
	// 	os.Getenv("POSTGRES_PASSWORD"),
	// 	os.Getenv("POSTGRES_HOST"),
	// 	os.Getenv("POSTGRES_PORT"),
	// 	os.Getenv("POSTGRES_DB"),
	// 	os.Getenv("POSTGRES_SSLMODE"),
	// )

	dsn := os.Getenv("DATABASE_URL")

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

	_, err = pool.Exec(ctx, `ALTER TABLE users ADD COLUMN IF NOT EXISTS company_role TEXT`)

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

	_, err = pool.Exec(ctx, `
		CREATE TABLE IF NOT EXISTS admins(
			email TEXT NOT NULL PRIMARY KEY,
			password TEXT NOT NULL
		)
	`)

	if err != nil {
		log.Fatal(err)
	}

	_, err = pool.Exec(ctx, `
		CREATE TABLE IF NOT EXISTS admin_tokens(
			email TEXT NOT NULL PRIMARY KEY,
			admin_token TEXT NOT NULL
		)
	`)

	if err != nil {
		log.Fatal(err)
	}

	_, err = pool.Exec(ctx, `
		DO $$ BEGIN
			CREATE TYPE status AS ENUM ('scheduled', 'active', 'ended');
		EXCEPTION
			WHEN duplicate_object THEN null;
		END $$;
	`)

	if err != nil {
		log.Fatal(err)
	}

	_, err = pool.Exec(ctx, `
		CREATE TABLE IF NOT EXISTS rooms(
			id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			created_by     TEXT,
			candidate_name TEXT,
			role           TEXT,
			join_code      TEXT,
			status         status NOT NULL DEFAULT 'scheduled',
			started_at     TIMESTAMPTZ,
			ended_at       TIMESTAMPTZ,
			created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
		)
	`)

	if err != nil {
		log.Fatal(err)
	}

	_, err = pool.Exec(ctx, `CREATE INDEX IF NOT EXISTS idx_rooms_created_by ON rooms(created_by)`)
	if err != nil {
		log.Fatal(err)
	}

	_, err = pool.Exec(ctx, `CREATE INDEX IF NOT EXISTS idx_rooms_status ON rooms(status)`)
	if err != nil {
		log.Fatal(err)
	}

	_, err = pool.Exec(ctx, `ALTER TABLE rooms ADD COLUMN IF NOT EXISTS join_status TEXT NOT NULL DEFAULT 'none'`)
	if err != nil {
		log.Fatal(err)
	}

	_, err = pool.Exec(ctx, `ALTER TABLE rooms ADD COLUMN IF NOT EXISTS requested_by TEXT`)
	if err != nil {
		log.Fatal(err)
	}

	_, err = pool.Exec(ctx, `ALTER TABLE rooms ADD COLUMN IF NOT EXISTS company_id INT REFERENCES Companies(id)`)
	if err != nil {
		log.Fatal(err)
	}

	_, err = pool.Exec(ctx, `CREATE INDEX IF NOT EXISTS idx_rooms_company_id ON rooms(company_id)`)
	if err != nil {
		log.Fatal(err)
	}

	return pool, nil
}
