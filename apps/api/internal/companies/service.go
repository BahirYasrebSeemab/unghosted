package companies

import (
	"context"
	"errors"
)

type CompanyService struct {
	repo *CompanyRepository
}

func NewCompanyService(repo *CompanyRepository) *CompanyService {
	return &CompanyService{
		repo: repo,
	}
}

var NotOwnerError = errors.New("user is not owner")
var NotAdminError = errors.New("user is not admin")

func (s *CompanyService) CreateCompany(ctx context.Context, company NotReadyCompany) error {
	var fullCompany CompanyWithoutId

	fullCompany.Name = company.Name
	fullCompany.Owner = company.Owner
	fullCompany.Admins = []string{}
	fullCompany.Hrs = []string{}
	fullCompany.Balance = 0

	err := s.repo.CreateCompany(ctx, fullCompany)

	return err
}

func (s *CompanyService) DeleteCompany(ctx context.Context, id int) error {
	err := s.DeleteCompany(ctx, id)

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
