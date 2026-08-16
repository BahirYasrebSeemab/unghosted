package auth

import (
	"encoding/json"
	"go-server/internal/pkg/httputil"
	"net/http"
)

type RefreshRequest struct {
	RefreshToken string `json:"refresh_token"`
}

type UserHandler struct {
	service *UserService
}

func NewUserHandler(service *UserService) *UserHandler {
	return &UserHandler{
		service: service,
	}
}

func (h *UserHandler) CreateTempUser(w http.ResponseWriter, r *http.Request) {
	var NotReadyUser NotReadyUser
	err := json.NewDecoder(r.Body).Decode(&NotReadyUser)

	if err != nil {
		http.Error(w, ("Incorrect data format"), http.StatusBadRequest)
		return
	}

	err = h.service.CreateTempUser(NotReadyUser)
	if err != nil {
		http.Error(w, err.Error(), 500)
		return
	}

	w.WriteHeader(http.StatusCreated)
}

func (h *UserHandler) CreateUser(w http.ResponseWriter, r *http.Request) {
	var ConfirmMessage ConfirmMessage

	err := json.NewDecoder(r.Body).Decode(&ConfirmMessage)

	if err != nil {
		http.Error(w, ("Incorrect data format"), http.StatusBadRequest)
		return
	}

	err = h.service.CreateUser(r.Context(), ConfirmMessage)
	if err != nil {
		http.Error(w, err.Error(), 500)
		return
	}

	// w.WriteHeader(http.StatusCreated)
	httputil.JSON(w, http.StatusCreated, ConfirmMessage)
}

func (h *UserHandler) Login(w http.ResponseWriter, r *http.Request) {
	// email, password
	var LoginRequest LogInData

	if err := httputil.DecodeJSON(r, &LoginRequest); err != nil {
		httputil.Error(w, err)
	}

	resp, err := h.service.Login(r.Context(), LoginRequest)

	if err != nil {
		httputil.Error(w, err)
		return
	}

	httputil.JSON(w, http.StatusOK, resp)
}

func (h *UserHandler) Refresh(w http.ResponseWriter, r *http.Request) {
	var req RefreshRequest

	if err := httputil.DecodeJSON(r, &req); err != nil {
		httputil.Error(w, err)
		return
	}

	resp, err := h.service.Refresh(r.Context(), req.RefreshToken)
	if err != nil {
		httputil.Error(w, err)
		return
	}

	httputil.JSON(w, http.StatusOK, resp)
}
