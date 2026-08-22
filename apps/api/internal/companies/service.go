package companies

import (
	"context"
	"errors"
	"go-server/internal/auth"
	"go-server/internal/errors/apierr"
	"go-server/internal/pkg/hashing"
)

type CompanyService struct {
	repo     *CompanyRepository
	userRepo *auth.UserRepository
}

func NewCompanyService(repo *CompanyRepository, userRepo *auth.UserRepository) *CompanyService {
	return &CompanyService{
		repo:     repo,
		userRepo: userRepo,
	}
}

var NotOwnerError = errors.New("user is not owner")
var NotAdminError = errors.New("user is not admin")

// CreateCompany provisions the company's owner as a `users` row (CompanyRole="owner" —
// that's the account's login for interviewer-app) and then creates the Companies row itself.
// Companies have no credential of their own; the owner's account is the login.
func (s *CompanyService) CreateCompany(ctx context.Context, req CreateCompanyRequest) error {
	hashedPassword, err := hashing.CreateHash(req.OwnerPassword)
	if err != nil {
		return apierr.Internal(err)
	}

	companyRole := "owner"
	err = s.userRepo.CreateUser(ctx, auth.User{
		Name:        req.OwnerName,
		Email:       req.OwnerEmail,
		Password:    hashedPassword,
		Companies:   []string{},
		CompanyRole: &companyRole,
	})
	if err != nil {
		return apierr.Conflict("owner email already has an account", err)
	}

	var fullCompany CompanyWithoutId
	fullCompany.Name = req.Name
	fullCompany.Owner = req.OwnerEmail
	fullCompany.Admins = []string{}
	fullCompany.Hrs = []string{}
	fullCompany.Balance = 0

	return s.repo.CreateCompany(ctx, fullCompany)
}

func (s *CompanyService) DeleteCompany(ctx context.Context, id int) error {
	err := s.repo.DeleteCompany(ctx, id)

	return err
}

func (s *CompanyService) ReduceBalance(ctx context.Context, value int, id int) error {
	err := s.repo.ReduceBalance(ctx, value, id)

	return err
}

func (s *CompanyService) IncreaseBalance(ctx context.Context, value int, id int) error {
	err := s.repo.IncreaseBalance(ctx, value, id)

	return err
}

func (s *CompanyService) UpdateCompanyName(ctx context.Context, name string, id int) error {
	err := s.repo.UpdateCompanyName(ctx, name, id)

	return err
}

func (s *CompanyService) AddAdmin(ctx context.Context, name string, id int) error {
	isOwner, err := s.repo.IsOwner(ctx, id)

	if !isOwner {
		return NotOwnerError
	}

	err = s.repo.AddAdmin(ctx, name, id)

	return err
}

func (s *CompanyService) AddHr(ctx context.Context, name string, id int) error {
	isOwner, err := s.repo.IsOwner(ctx, id)
	isAdmin, err := s.repo.IsAdmin(ctx, name, id)

	if !isOwner && !isAdmin {
		return NotAdminError
	}
	err = s.repo.AddHr(ctx, name, id)

	return err
}
