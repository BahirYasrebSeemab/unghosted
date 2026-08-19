package companies

import (
	"context"
	"encoding/json"
	"fmt"
	"go-server/internal/pkg/httputil"
	"net/http"
)

type CompanyHandler struct {
	service *CompanyService
}

func NewCompanyHandler(service *CompanyService) *CompanyHandler {
	return &CompanyHandler{
		service: service,
	}
}

func (h *CompanyHandler) CreateCompany(w http.ResponseWriter, r *http.Request) {
	ctx := context.Background()

	var Name OnlyName
	var Email string

	err := json.NewDecoder(r.Body).Decode(&Name)
	Email, ok := r.Context().Value("Email").(string)
	if !ok {
		fmt.Println(Email)
		http.Error(w, "Unauthorized1", http.StatusUnauthorized)
		return
	}

	if err != nil {
		http.Error(w, ("Incorrect data format"), http.StatusBadRequest)
		return
	}

	company := &NotReadyCompany{
		Name:  Name.Name,
		Owner: Email,
	}

	err = h.service.CreateCompany(ctx, *company)

	if err != nil {
		httputil.Error(w, err)
	}

	w.WriteHeader(http.StatusCreated)
}

func (h *CompanyHandler) DeleteCompany(w http.ResponseWriter, r *http.Request) {
	ctx := context.Background()

	var id int
	err := json.NewDecoder(r.Body).Decode(&id)

	if err != nil {
		http.Error(w, ("Incorrect data format"), http.StatusBadRequest)
		return
	}

	err = h.service.DeleteCompany(ctx, id)

	if err != nil {
		httputil.Error(w, err)
	}

	w.WriteHeader(http.StatusOK)
}

func (h *CompanyHandler) UpdateCompanyName(w http.ResponseWriter, r *http.Request) {
	ctx := context.Background()

	var request IdWithName
	err := json.NewDecoder(r.Body).Decode(&request)

	if err != nil {
		http.Error(w, ("Incorrect data format"), http.StatusBadRequest)
		return
	}

	err = h.service.UpdateCompanyName(ctx, request.Name, request.Id)

	if err != nil {
		httputil.Error(w, err)
	}
	
	w.WriteHeader(http.StatusOK)
}

func (h *CompanyHandler) ReduceBalance(w http.ResponseWriter, r *http.Request) {
	ctx := context.Background()

	var request IdWithValue
	err := json.NewDecoder(r.Body).Decode(&request)

	if err != nil {
		http.Error(w, ("Incorrect data format"), http.StatusBadRequest)
		return
	}

	err = h.service.ReduceBalance(ctx, request.Value, request.Id)

	if err != nil {
		httputil.Error(w, err)
	}

	w.WriteHeader(http.StatusOK)
}

func (h *CompanyHandler) IncreaseBalance(w http.ResponseWriter, r *http.Request) {
	ctx := context.Background()

	var request IdWithValue
	err := json.NewDecoder(r.Body).Decode(&request)

	if err != nil {
		http.Error(w, ("Incorrect data format"), http.StatusBadRequest)
		return
	}

	err = h.service.ReduceBalance(ctx, request.Value, request.Id)

	if err != nil {
		httputil.Error(w, err)
	}

	
	w.WriteHeader(http.StatusOK)
}

func (h *CompanyHandler) AddAdmin(w http.ResponseWriter, r *http.Request) {
	ctx := context.Background()

	var request IdWithName
	err := json.NewDecoder(r.Body).Decode(&request)

	if err != nil {
		http.Error(w, ("Incorrect data format"), http.StatusBadRequest)
		return
	}

	err = h.service.AddAdmin(ctx, request.Name, request.Id)

	if err != nil {
		httputil.Error(w, err)
	}

	w.WriteHeader(http.StatusCreated)
}

func (h *CompanyHandler) AddHr(w http.ResponseWriter, r *http.Request) {
	ctx := context.Background()

	var request IdWithName
	err := json.NewDecoder(r.Body).Decode(&request)

	if err != nil {
		http.Error(w, ("Incorrect data format"), http.StatusBadRequest)
		return
	}

	err = h.service.AddHr(ctx, request.Name, request.Id)

	if err != nil {
		httputil.Error(w, err)
	}

	w.WriteHeader(http.StatusCreated)
}
