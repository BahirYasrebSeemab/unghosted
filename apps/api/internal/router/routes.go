package router

import (
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"

	"go-server/internal/auth"
	"go-server/internal/companies"
	Ourmiddleware "go-server/internal/middleware"
	"go-server/internal/room"
)

type Dependencies struct {
	AuthHandler    *auth.UserHandler
	AuthService    *auth.UserService
	RoomHandler    *room.RoomHandler
	CompanyHandler *companies.CompanyHandler
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

		r.Post("/users/sendCode", deps.AuthHandler.CreateTempUser)
		r.Post("/users/register", deps.AuthHandler.CreateUser)

		r.Post("/users/login", deps.AuthHandler.Login)
		r.Post("/auth/refresh", deps.AuthHandler.Refresh)

		r.Route("/companies", func(r chi.Router) {
			r.Use(Ourmiddleware.AuthMiddleware(deps.AuthService))
			r.Post("/create", deps.CompanyHandler.CreateCompany)
			r.Delete("/delete", deps.CompanyHandler.DeleteCompany)
			r.Patch("/reduceBalance", deps.CompanyHandler.ReduceBalance)
			r.Patch("/increaseBalance", deps.CompanyHandler.IncreaseBalance)
			r.Patch("/updateName", deps.CompanyHandler.UpdateCompanyName)
			r.Post("/addAdmin", deps.CompanyHandler.AddAdmin)
			r.Post("/addHr", deps.CompanyHandler.AddHr)
		})

		// Register new user
		// r.Post("/users/register", deps.AuthHandler.CreateTempUser)
	})

	return r
}
