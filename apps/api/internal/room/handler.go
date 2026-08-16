package room

import (
	"fmt"
	_ "go-server/internal/errors/apierr"
	"go-server/internal/pkg/httputil"
	"net/http"

	"github.com/fasthttp/websocket"
	"github.com/go-chi/chi/v5"
	_ "github.com/google/uuid"
)

type RoomHandler struct {
	service *RoomService
}

func NewRoomHandler(service *RoomService) *RoomHandler {
	return &RoomHandler {
		service: service,
	}
}

func (h *RoomHandler) Create(w http.ResponseWriter, r *http.Request) {
	var req CreateRoomRequest


	if err := httputil.DecodeJSON(r, &req); err != nil {
		httputil.Error(w, err)
		return
	}

	room, err := h.service.CreateRoom(r.Context(), req)
	
	if err != nil {
		httputil.Error(w, err)
		return
	}

	httputil.JSON(w, http.StatusCreated, room)
}

func (h *RoomHandler) List(w http.ResponseWriter, r *http.Request) {
	rooms, err := h.service.ListRooms(r.Context())
	if err != nil {
		httputil.Error(w, err)
		return
	}

	httputil.JSON(w, http.StatusOK, rooms)
}

func (h *RoomHandler) Get(w http.ResponseWriter, r *http.Request) {
	roomID := chi.URLParam(r, "roomID")
	fmt.Printf("ID to get: %s", roomID)
	// joinCode, err := joinCodeParam.

	// Code validation instead
	// if err != nil {
	// 	httputil.Error(w, apierr.Validation("invalid room id", err))
	// 	return
	// }

	room, err := h.service.GetByID(r.Context(), roomID)

	if err != nil {
		httputil.Error(w, err)
		return
	}

	httputil.JSON(w, http.StatusOK, room)
}

// func (h *RoomHandler) Connect(w http.ResponseWriter, r *http.Request) {
	// joinCode := chi.URLParam(r, "join_code")
	//
	// room, err := h.service.GetByJoinCode(r.Context(), joinCode)
	// if err != nil {
	// 	httputil.Error(w, err)
	// 	return
	// }
	//
	// conn, err := h.service.ConnectToRoom(r.Context(), joinCode)
	//
	// if err != nil {
	// 	httputil.Error(w, err)
	// 	return
	// }
	//
	//
	// httputil.JSON(w, http.StatusOK, room)

// 	conn, err := upgrader.Upgrade(w, r, nil)
//
// }


// func (h *RoomHandler) ConnectRoomWebsocket(w http.ResponseWriter, r *http.Request, c *websocket.Conn) {
// 	joinCode := chi.URLParam(r, "join_code")
//
// 	if joinCode == "" {
// 		return
// 	}
//
// 	fmt.Printf("JOIN CODE: %s", joinCode)
// 	room, err := h.service.GetByJoinCode(joinCode)
// }

func (h *RoomHandler) RoomWebsocket(c *websocket.Conn, w http.ResponseWriter, r *http.Request) {
	var req CreateRoomRequest
	join_code := chi.URLParam(r, "join_code")

	if join_code == "" { 
		httputil.Error(w, ErrRoomNotFound)
		return 
	}

	if err := httputil.DecodeJSON(r, &req); err != nil {
		httputil.Error(w, err)
		return
	}

	room, err := h.service.CreateRoom(r.Context(), req)
	
	if err != nil {
		httputil.Error(w, err)
		return
	}

	httputil.JSON(w, http.StatusCreated, room)
}
