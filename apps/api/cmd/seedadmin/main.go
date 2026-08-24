// Standalone CLI to create (or reset the password of) an admin account, hashed the same way
// AdminService.CheckAdmin verifies it (argon2id via internal/pkg/hashing) — there is no other
// way to get an admin into a fresh/reset database, since admins are never self-registered.
//
// Usage (from apps/api):
//
//	go run ./cmd/seedadmin -email admin@example.com -password "correct horse battery staple"
package main

import (
	"context"
	"flag"
	"fmt"
	"log"
	"os"

	db "go-server/internal/database"
	"go-server/internal/pkg/hashing"
)

func main() {
	email := flag.String("email", "", "admin email")
	password := flag.String("password", "", "admin password (plain text — will be hashed before storing)")
	flag.Parse()

	if *email == "" || *password == "" {
		fmt.Fprintln(os.Stderr, "usage: seedadmin -email <email> -password <password>")
		os.Exit(1)
	}

	ctx := context.Background()

	// NewPostgresPool also runs every CREATE TABLE/ALTER TABLE migration in
	// internal/database/postgres.go before returning, so this is also safe to run
	// straight after wiping/recreating the database — no need to start the API first.
	pool, err := db.NewPostgresPool(ctx)
	if err != nil {
		log.Fatalf("connecting to database: %v", err)
	}
	defer pool.Close()

	hashed, err := hashing.CreateHash(*password)
	if err != nil {
		log.Fatalf("hashing password: %v", err)
	}

	const query = `
		INSERT INTO admins (email, password)
		VALUES ($1, $2)
		ON CONFLICT (email) DO UPDATE SET password = EXCLUDED.password
	`

	if _, err := pool.Exec(ctx, query, *email, hashed); err != nil {
		log.Fatalf("inserting admin: %v", err)
	}

	fmt.Printf("admin ready: %s\n", *email)
}
