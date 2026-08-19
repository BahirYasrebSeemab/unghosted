// Package httputil holds small helpers shared by every HTTP handler,
// so handlers don't each reinvent JSON encoding/error responses.
package httputil

import (
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"

	"go-server/internal/errors/apierr"
)

func JSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	if v == nil {
		return
	}
	if err := json.NewEncoder(w).Encode(v); err != nil {
		slog.Error("failed to encode json response", "error", err)
	}
}

func Error(w http.ResponseWriter, err error) {
	var apiErr *apierr.Error
	if errors.As(err, &apiErr) {
		if apiErr.Status >= 500 {
			slog.Error("internal error", "code", apiErr.Code, "error", apiErr.Err)
		}
		JSON(w, apiErr.Status, apiErr)
		return
	}

	slog.Error("unhandled error", "error", err)
	JSON(w, http.StatusInternalServerError, apierr.Internal(err))
}

func DecodeJSON(r *http.Request, v any) error {
	if err := json.NewDecoder(r.Body).Decode(v); err != nil {
		return apierr.Validation("invalid request body", err)
	}
	return nil
}
