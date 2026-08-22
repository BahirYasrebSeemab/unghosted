package companies

import (
	"context"
	"encoding/json"
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

	var req CreateCompanyRequest
	err := json.NewDecoder(r.Body).Decode(&req)

	if err != nil {
		http.Error(w, ("Incorrect data format"), http.StatusBadRequest)
		return
	}

	err = h.service.CreateCompany(ctx, req)

	if err != nil {
		httputil.Error(w, err)
		return
	}

	w.WriteHeader(http.StatusCreated)
}

func (h *CompanyHandler) ListCompanies(w http.ResponseWriter, r *http.Request) {
	ctx := context.Background()

	companies, err := h.service.ListCompanies(ctx)
	if err != nil {
		httputil.Error(w, err)
		return
	}

	httputil.JSON(w, http.StatusOK, companies)
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

	err = h.service.IncreaseBalance(ctx, request.Value, request.Id)

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
