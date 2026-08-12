package room

import (
	"go-server/internal/errors/apierr"
	"go-server/internal/pkg/httputil"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
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
	idParam := chi.URLParam(r, "id")
	id, err := uuid.Parse(idParam)

	if err != nil {
		httputil.Error(w, apierr.Validation("invalid room id", err))
		return
	}

	room, err := h.service.GetByID(r.Context(), id)
	if err != nil {
		httputil.Error(w, err)
		return
	}

	httputil.JSON(w, http.StatusOK, room)
}
