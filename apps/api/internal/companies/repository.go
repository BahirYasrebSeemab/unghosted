package companies

import (
	"context"

	"github.com/jackc/pgx/v5/pgxpool"
)

type CompanyRepository struct {
	DB *pgxpool.Pool
}

func NewRepository(DB *pgxpool.Pool) *CompanyRepository {
	return &CompanyRepository{
		DB: DB,
	}
}

func (r *CompanyRepository) CreateCompany(ctx context.Context, company CompanyWithoutId) error {
	const query = `
		INSERT INTO Companies (Name , Owner , Admins , Hrs , Balance)
		VALUES ($1 , $2 , $3 , $4 , $5)
	`

	_, err := r.DB.Exec(ctx, query, company.Name, company.Owner, company.Admins, company.Hrs, company.Balance)

	return err
}

func (r *CompanyRepository) DeleteCompany(ctx context.Context, id int) error {
	const query = `
		DELETE FROM Companies WHERE Id = $1 
	`

	_, err := r.DB.Exec(ctx, query, id)

	return err
}

func (r *CompanyRepository) ReduceBalance(ctx context.Context, value int, id int) error {
	const query = `
		UPDATE Comapnies SET Balance = Balance - $1 WHERE Id = $2
	`

	_, err := r.DB.Exec(ctx, query, value, id)

	return err
}

func (r *CompanyRepository) IncreaseBalance(ctx context.Context, value int, id int) error {
	const query = `
		UPDATE Comapnies SET Balance = Balance + $1 WHERE Id = $2
	`

	_, err := r.DB.Exec(ctx, query, value, id)

	return err
}

func (r *CompanyRepository) UpdateCompanyName(ctx context.Context, name string, id int) error {
	const query = `
		UPDATE Companies SET name = $1 WHERE Id = $2
	`

	_, err := r.DB.Exec(ctx, query, name, id)

	return err
}

func (r *CompanyRepository) AddAdmin(ctx context.Context, name string, id int) error {
	const query = `
		UPDATE Companies 
		SET Admins = array_append(coalesce(Admins, '{}'), $1) 
		WHERE Id = $2 AND NOT ($1 = ANY(coalesce(Admins, '{}')))
	`

	_, err := r.DB.Exec(ctx, query, name, id)

	return err
}

func (r *CompanyRepository) AddHr(ctx context.Context, name string, id int) error {
	const query = `
		UPDATE Companies 
		SET Hrs = array_append(coalesce(Hrs, '{}'), $1) 
		WHERE Id = $2 AND NOT ($1 = ANY(coalesce(Hrs, '{}')))
	`

	_, err := r.DB.Exec(ctx, query, name, id)

	return err
}

func (r *CompanyRepository) DeleteAdmin(ctx context.Context, name string, id int) error {
	const query = `
		UPDATE Companies 
		SET Admins = array_remove(coalesce(Admins, '{}'), $1) 
		WHERE Id = $2
	`

	_, err := r.DB.Exec(ctx, query, name, id)

	return err
}

func (r *CompanyRepository) DeleteHr(ctx context.Context, name string, id int) error {
	const query = `
		UPDATE Companies 
		SET Hrs = array_remove(coalesce(Hrs, '{}'), $1) 
		WHERE Id = $2
	`

	_, err := r.DB.Exec(ctx, query, name, id)

	return err
}

func (r *CompanyRepository) IsOwner(ctx context.Context, id int) (bool, error) {
	const query = `
		SELECT Owner FROM Companies WHERE Id = $1
	`

	_, err := r.DB.Exec(ctx, query, id)

	if err != nil {
		return false, err
	}

	return true, err
}

func (r *CompanyRepository) IsAdmin(ctx context.Context, name string, id int) (bool, error) {
	const query = `
		SELECT ($1 = ANY(coalesce(Admins, '{}'))) AS has_admin 
		FROM Companies 
		WHERE Id = $2
	`

	_, err := r.DB.Exec(ctx, query, name, id)

	if err != nil {
		return false, err
	}

	return true, err
}
