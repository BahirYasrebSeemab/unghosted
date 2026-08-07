package auth

import (
	"encoding/json"
	"net/http"
)

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
	}

	err = h.service.CreateUser(ConfirmMessage)
	if err != nil {
		http.Error(w, err.Error(), 500)
		return
	}

	w.WriteHeader(http.StatusCreated)
}
