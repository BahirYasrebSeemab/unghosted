package db

import (
	"context"
	"fmt"
	"time"

	"os"
	_ "github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"log"
)

// func Connect_to_db() (*pgxpool.Conn, error) {
// 	err := godotenv.Load()
// 	if err != nil {
// 		log.Fatal("Ошибка заргузки .env: ", err)
// 	}
//
// 	dsn := fmt.Sprintf(
// 		"postgres://%s:%s@localhost:%s/%s?sslmode=%s",
// 		os.Getenv("POSTGRES_USER"),
// 		os.Getenv("POSTGRES_PASSWORD"),
// 		os.Getenv("POSTGRES_PORT"),
// 		os.Getenv("POSTGRES_NAME"),
// 		os.Getenv("POSTGRES_SSLMODE"),
// 	)
//
// 	ctx := context.Background()
//
// 	conn, err := pgx.Connect(
// 		context.Background(),
// 		dsn,
// 	)
//
// 	pool, err := pgxpool.New(ctx, dsn)
//
// 	if err != nil { 
// 		return nil, fmt.Errorf("Couldn't connect to DB: %v", err)
// 	}
//
// 	if err := pool.Ping(ctx); err != nil {
//
// 	}
//
// 	return conn, nil
// }


func NewPostgresPool(ctx context.Context) (*pgxpool.Pool, error) {
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

	if err != nil {
		log.Fatal(err)
	}

	return pool, nil
}
