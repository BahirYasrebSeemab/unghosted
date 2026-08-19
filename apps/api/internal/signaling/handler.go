package signaling

import (
	"errors"
	"go-server/internal/pkg/httputil"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/gorilla/websocket"
	"time"
)

const (
	writeWait = 10 * time.Second

	pongWait = 30 * time.Second

	pingPeriod = (pongWait * 9) / 10

	MaxMessageSize = 1024 * 1024 // 1mb
)

var (
	newline = []byte("\n")
	space = []byte(" ")
)

type Handler struct {
	hub *Hub
	upgrader websocket.Upgrader
}

func NewHandler(hub *Hub) *Handler {
	return &Handler {
		hub: hub,
		upgrader: websocket.Upgrader{
			// TODO Kinda CORS, should be Electron's origin
			CheckOrigin: func(r *http.Request) bool { return true },
			ReadBufferSize: 1024 * 1024, // 1mb
			WriteBufferSize: 1024 * 1024,
		},
	}
}

func (h *Handler) HandleConnection(w http.ResponseWriter, r *http.Request) {
	roomID := chi.URLParam(r, "roomID")

	// TODO OR TOTHINK: replace email with real UUID
	email, ok := r.Context().Value("Email").(string)

	if !ok || email == "" {
		httputil.Error(w, errors.New("Unauthorized"))
		return
	}

	conn, err := h.upgrader.Upgrade(w, r, nil)
	if err != nil { 
		return
	}

	client := NewClient(email, roomID, conn, h.hub)
	h.hub.join <- client

	go client.writePump()
	go client.readPump()
}
