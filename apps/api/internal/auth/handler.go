package auth

import (
	"encoding/json"
	"fmt"
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

	http.SetCookie(w, &http.Cookie{
		Name:     "refresh_token",
		Value:    resp.RefreshToken,
		Path:     "/",
		HttpOnly: true,
		Secure:   false,
		SameSite: http.SameSiteLaxMode,
		MaxAge:   60 * 21600,
	})

	json.NewEncoder(w).Encode(map[string]string{
		"access_token": resp.Token,
	})
}

// refresh token should be inserted into database, and user moved from temp to real user

func (h *UserHandler) Refresh(w http.ResponseWriter, r *http.Request) {
	refresh_token, err := r.Cookie("refresh_token")
	fmt.Println("ALL COOKIES:", r.Cookies())
	if err != nil {
		http.Error(w, "refresh token cookie not found", http.StatusUnauthorized)
		return
	}

	resp, err := h.service.Refresh(r.Context(), refresh_token.Value)
	if err != nil {
		httputil.Error(w, err)
		fmt.Println(err)
		return
	}

	json.NewEncoder(w).Encode(map[string]string{
		"access_token": resp,
	})
}

func (h *UserHandler) LogOut(w http.ResponseWriter, r *http.Request) {
	refresh_token, err := r.Cookie("refresh_token")

	if err != nil {
		httputil.Error(w, err)
	}

	err = h.service.LogOut(r.Context(), refresh_token.Value)
	if err != nil {
		httputil.Error(w, err)
		fmt.Println(err)
		return
	}

	httputil.JSON(w, http.StatusOK, nil)
}
