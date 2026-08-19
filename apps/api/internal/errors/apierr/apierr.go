package apierr

import "net/http"

type Error struct {
	Status int `json:"-"`
	Code string `json:"code"`
	Message string `json:"message"`
	Err error `json:"-"`
}


func (e *Error) Error() string {
	if e.Err != nil {
		return e.Message + ": " + e.Err.Error()
	}

	return e.Message
}

func (e *Error) Unwrap() error { return e.Err }

func New(status int, code, message string, err error) *Error {
	return &Error{Status: status, Code: code, Message: message, Err: err}
}

func NotFound(message string, err error) *Error {
	return New(http.StatusNotFound, "not_found", message, err)
}

func Validation(message string, err error) *Error {
	return New(http.StatusBadRequest, "validation_error", message, err)
}

func Unauthorized(message string, err error) *Error {
	return New(http.StatusUnauthorized, "unauthorized", message, err)
}

func Forbidden(message string, err error) *Error {
	return New(http.StatusForbidden, "forbidden", message, err)
}

func Internal(err error) *Error {
	return New(http.StatusInternalServerError, "internal_error", "something went wrong", err)
}

func Conflict(message string, err error) *Error {
	return New(http.StatusConflict, "conflict", message, err)
}


