package router

import (
	"go-server/internal/auth"

	"github.com/go-chi/chi/v5"
)

func CreateUserRouter(userHandler *auth.UserHandler) *chi.Mux {
	r := chi.NewRouter()

	r.Post("/users/SendCode", userHandler.CreateTempUser)
	r.Post("/users/login", userHandler.CreateUser)

	return r
}
