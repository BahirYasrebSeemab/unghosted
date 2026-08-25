package signaling

import (
	"errors"
	"go-server/internal/pkg/httputil"
	"go-server/internal/room"
	"log/slog"
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
	hub         *Hub
	roomService *room.RoomService
	upgrader    websocket.Upgrader
}

func NewHandler(hub *Hub, roomService *room.RoomService) *Handler {
	return &Handler {
		hub:         hub,
		roomService: roomService,
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

	if err := h.roomService.RecordCallJoin(r.Context(), roomID, email); err != nil {
		slog.Error("failed to record call join", "error", err, "room_id", roomID, "email", email)
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
