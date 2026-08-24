package admins

import (
	"context"
	"encoding/json"
	"log/slog"
	"net/http"
)

type AdminHandler struct {
	service *AdminService
}

func NewAdminHandler(service *AdminService) *AdminHandler {
	return &AdminHandler{
		service: service,
	}
}

func (h *AdminHandler) CheckAdmin(w http.ResponseWriter, r *http.Request) {
	ctx := context.Background()
	var data LogInData

	err := json.NewDecoder(r.Body).Decode(&data)

	if err != nil {
		http.Error(w, ("Incorrect data format"), http.StatusBadRequest)
		return
	}

	admin_token, isAdmin, err := h.service.CheckAdmin(ctx, data)

	if err != nil {
		slog.Error("admin login failed", "email", data.Email, "error", err)
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}

	if !isAdmin {
		http.Error(w, "invalid credentials", http.StatusUnauthorized)
		return
	}

	http.SetCookie(w, &http.Cookie{
		Name:     "admin_token",
		Value:    admin_token,
		Path:     "/",
		HttpOnly: true,
		Secure:   false,
		SameSite: http.SameSiteLaxMode,
		MaxAge:   60 * 21600,
	})
}
