package database

import (
	"context"
	"fmt"
	"log"
	"os"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/joho/godotenv"
)

func Connect_to_db() (*pgxpool.Pool, error) {
	err := godotenv.Load()
	if err != nil {
		log.Fatal("Ошибка заргузки .env: ", err)
	}

	connectStr := fmt.Sprintf(
		"postgres://%s:%s@localhost:%s/%s?sslmode=%s",
		os.Getenv("USER"),
		os.Getenv("PASSWORD"),
		os.Getenv("PORT"),
		os.Getenv("DB_NAME"),
		os.Getenv("SSLMODE"),
	)

	ctx := context.Background()

	pool, err := pgxpool.New(ctx, connectStr)

	if err != nil {
		return nil, fmt.Errorf("не получилось подключится к БД: %v", err)
	}

	if err := pool.Ping(ctx); err != nil {
		return nil, fmt.Errorf("ping не прошел: %v", err)
	}

	_, err = pool.Exec(ctx, `
		CREATE TABLE IF NOT EXISTS temp_users(
			Name TEXT NOT NULL,
			Email TEXT NOT NULL PRIMARY KEY,
			Code INT NOT NULL,
			Password TEXT NOT NULL,
			Finish_time TIMESTAMP
		)
	`)

	if err != nil {
		log.Fatal(err)
	}

	_, err = pool.Exec(ctx, `
		CREATE TABLE IF NOT EXISTS users(
			Name TEXT NOT NULL,
			Email TEXT NOT NULL PRIMARY KEY,
			Password TEXT NOT NULL,
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

	return pool, nil
}
