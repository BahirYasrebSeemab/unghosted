package main

import (
	"context"
	"log/slog"
	_ "net/http"
	"os/signal"
	"strconv"
	"syscall"

	// _ "server"
	"go-server/internal/admins"
	"go-server/internal/auth"
	"go-server/internal/companies"
	"go-server/internal/config"
	db "go-server/internal/database"
	"go-server/internal/room"
	"go-server/internal/router"
	"go-server/internal/server"

	"go-server/internal/signaling"

	"github.com/joho/godotenv"

	"flag"
	"os"
	"time"
)

const version = "1.0.0"

func main() {
	if err := run(); err != nil {
		slog.Error("fatal error", "error", err)
		os.Exit(1)
	}
}

func run() error {
	if err := godotenv.Load(); err != nil {
		slog.Warn("no .env file found, using existing environment", "error", err)
	}

	cfg, err := config.Load()
	if err != nil {
		return err
	}

	flag.IntVar(&cfg.Port, "port", 3000, "SERVER API PORT")
	flag.StringVar(&cfg.Env, "env", "development", "Environment (development|staging|production)")
	flag.Parse()

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	pool, err := db.NewPostgresPool(ctx)

	if err != nil {
		return err
	}

	defer pool.Close()

	authRepo := auth.NewRepository(pool)
	authService := auth.NewUserService(
		authRepo,
		cfg.JWTSecret,
		cfg.JWTAccessExpiration,
		cfg.JWTRefreshExpiration,
	)
	authHandler := auth.NewUserHandler(authService)

	companyRepo := companies.NewRepository(pool)
	companyService := companies.NewCompanyService(companyRepo, authRepo)
	companyHandler := companies.NewCompanyHandler(companyService)

	roomRepo := room.NewRepository(pool)
	roomService := room.NewRoomService(roomRepo, companyRepo)
	roomHandler := room.NewRoomHandler(roomService)

	adminRepo := admins.NewRepository(pool)
	adminService := admins.NewAdminService(
		adminRepo,
		cfg.JWTSecret,
		cfg.JWTAccessExpiration,
		cfg.JWTRefreshExpiration,
	)
	adminHandler := admins.NewAdminHandler(adminService)

	hub := signaling.NewHub()
	go hub.Run()

	signalingHandler := signaling.NewHandler(hub)

	httpHandler := router.New(router.Dependencies{
		AuthHandler:      authHandler,
		AuthService:      authService,
		RoomHandler:      roomHandler,
		SignalingHandler: signalingHandler,
		CompanyHandler:   companyHandler,
		AdminService:     adminService,
		AdminHandler:     adminHandler,
		AllowedOrigin:    cfg.AllowedOrigin,
	})

	srv := server.New(":"+strconv.Itoa(cfg.Port), httpHandler)

	errCh := make(chan error, 1)
	go func() {
		slog.Info("server is starting", "port", cfg.Port, "env", cfg.Env)
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
