package main

import (
	"context"
	"log/slog"
	_ "net/http"
	"os/signal"
	"strconv"
	"syscall"

	// _ "server"
	"go-server/internal/auth"
	"go-server/internal/database"
	"go-server/internal/room"
	"go-server/internal/router"
	"go-server/internal/server"
	"github.com/joho/godotenv"

	"flag"
	"os"
	"time"
)

const version = "1.0.0"

// Config setting for app
type config struct {
	port int
	env string
}

func main() {
	if err := run(); err != nil {
		slog.Error("fatal error", "error", err)
		os.Exit(1)
	}
}

func run() error {
	var cfg config;
	flag.IntVar(&cfg.port, "port", 3000, "SERVER API PORT")
	flag.StringVar(&cfg.env, "env", "development", "Environment (development|staging|production)")
	flag.Parse()

	if err := godotenv.Load(); err != nil {
		slog.Warn("no .env file found, using existing environment", "error", err)
	}
	
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	pool, err := db.NewPostgresPool(ctx)

	if err != nil {
		return err
	}

	defer pool.Close()

	authRepo := auth.NewRepository(pool)
	authService := auth.NewUserService(authRepo)
	authHandler := auth.NewUserHandler(authService)

	roomRepo := room.NewRepository(pool)
	roomService := room.NewRoomService(roomRepo)
	roomHandler := room.NewRoomHandler(roomService)

	httpHandler := router.New(router.Dependencies{
		AuthHandler: authHandler,
		AuthService: authService,
		RoomHandler: roomHandler,
	})

	srv := server.New(":"+strconv.Itoa(cfg.port), httpHandler)

	errCh := make(chan error, 1)
	go func() {
		slog.Info("server is starting", "port", cfg.port, "env", cfg.env)
		errCh <- srv.Start()
	}()

	select {
	case err := <-errCh:
		return err
	case <-ctx.Done():
		slog.Info("shutdown signal received")
	}

	shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	if err := srv.Shutdown(shutdownCtx); err != nil {
		return err
	}

	slog.Info("server stoped cleanly")
	return nil
}
