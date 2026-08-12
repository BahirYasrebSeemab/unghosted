package router

import (
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"

	"go-server/internal/room"
	"go-server/internal/auth"
)

type Dependencies struct {
	AuthHandler *auth.UserHandler
	AuthService *auth.UserService
	RoomHandler *room.RoomHandler
}

func New(deps Dependencies) http.Handler {
	r := chi.NewRouter()

	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)

	r.Get("/healthz", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("ok"))
	})

	r.Route("/v1", func(r chi.Router) {
		// r.Post("/auth/register", deps.AuthHandler.Register)
		// r.Post("/auth/login", deps.AuthHandler.Login)

		r.Route("/rooms", func(r chi.Router) {
			r.Post("/", deps.RoomHandler.Create)
			r.Get("/", deps.RoomHandler.List)
			r.Post("/{id}", deps.RoomHandler.Get)
		})

		r.Post("/users/SendCode", deps.AuthHandler.CreateTempUser)
		r.Post("/users/login", deps.AuthHandler.CreateUser)
	})

	return r
}

