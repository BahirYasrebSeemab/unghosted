package router

import (
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"

	"go-server/internal/auth"
	mdw "go-server/internal/middleware"
	"go-server/internal/room"
	"go-server/internal/signaling"
)

type Dependencies struct {
	AuthHandler 		*auth.UserHandler
	AuthService 		*auth.UserService
	RoomHandler 		*room.RoomHandler
	SignalingHandler	*signaling.Handler
}

func New(deps Dependencies) http.Handler {
	r := chi.NewRouter()

	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)
	// TODO: Cors middleware here

	r.Get("/healthz", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("ok"))
	})

	r.Route("/v1", func(r chi.Router) {
		// r.Post("/auth/register", deps.AuthHandler.Register)
		// r.Post("/auth/login", deps.AuthHandler.Login)

		r.Group(func(r chi.Router) {
			r.Use(mdw.AuthMiddleware)

			r.Route("/room", func(r chi.Router) {
				r.Post("/create", deps.RoomHandler.Create)
				r.Get("/list", deps.RoomHandler.List)

				r.Route("/{roomID}", func(r chi.Router) {
					r.Get("/", deps.RoomHandler.Get)
					r.Get("/ws", deps.SignalingHandler.HandleConnection)
					// r.Get("/websocket", deps.ViewerWsHandler.ServeWs)
					//
					// r.Get("/chat", deps.ViewerWsHandler.ServeWs)
					// r.Get("/websocket/chat", deps.ViewerWsHandler.ServeWs)
					//
					// r.Get("/viewer/websocket", deps.ViewerWsHandler.ServeWs)
				})
			})
			
		})
		
		// r.Route("/rooms/{id}", func(r chi.Router) {
		// 	r.Get("/", func(w http.ResponseWriter, r *http.Request) {
		// 		w.Write([]byte("hello world"))
		// 	})
		// })

		r.Post("/auth/refresh", deps.AuthHandler.Refresh)
		r.Post("/users/sendCode", deps.AuthHandler.CreateTempUser)
		r.Post("/users/register", deps.AuthHandler.CreateUser)

		r.Post("/users/login", deps.AuthHandler.Login)
	})

	return r
}

