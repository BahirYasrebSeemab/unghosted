package companies

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

var ErrCompanyNotFound = errors.New("company not found")

type CompanyRepository struct {
	DB *pgxpool.Pool
}

func NewRepository(DB *pgxpool.Pool) *CompanyRepository {
	return &CompanyRepository{
		DB: DB,
	}
}

func (r *CompanyRepository) GetByID(ctx context.Context, id int) (*Company, error) {
	const query = `SELECT id, name, owner, admins, hrs, balance FROM Companies WHERE id = $1`

	var company Company
	err := r.DB.QueryRow(ctx, query, id).
		Scan(&company.Id, &company.Name, &company.Owner, &company.Admins, &company.Hrs, &company.Balance)

	if err != nil && errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrCompanyNotFound
	}
	if err != nil {
		return nil, err
	}

	return &company, nil
}

// GetCompanyByMemberEmail resolves which company an authenticated user belongs to — as owner,
// admin, or hr — since there's no reverse index from users to companies (Companies.Admins/Hrs
// are plain email arrays). Used to scope room creation/listing to the caller's own company.
func (r *CompanyRepository) GetCompanyByMemberEmail(ctx context.Context, email string) (*Company, error) {
	const query = `
		SELECT id, name, owner, admins, hrs, balance FROM Companies
		WHERE owner = $1 OR $1 = ANY(coalesce(admins, '{}')) OR $1 = ANY(coalesce(hrs, '{}'))
		LIMIT 1
	`

	var company Company
	err := r.DB.QueryRow(ctx, query, email).
		Scan(&company.Id, &company.Name, &company.Owner, &company.Admins, &company.Hrs, &company.Balance)

	if err != nil && errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrCompanyNotFound
	}
	if err != nil {
		return nil, err
	}

	return &company, nil
}

func (r *CompanyRepository) CreateCompany(ctx context.Context, company CompanyWithoutId) error {
	const query = `
		INSERT INTO Companies (name , owner , admins , hrs , balance)
		VALUES ($1 , $2 , $3 , $4 , $5)
	`

	_, err := r.DB.Exec(ctx, query, company.Name, company.Owner, company.Admins, company.Hrs, company.Balance)

	return err
}

func (r *CompanyRepository) ListCompanies(ctx context.Context) ([]Company, error) {
	const query = `
		SELECT id, name, owner, admins, hrs, balance FROM Companies ORDER BY id
	`

	rows, err := r.DB.Query(ctx, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var companies []Company
	for rows.Next() {
		var company Company
		if err := rows.Scan(&company.Id, &company.Name, &company.Owner, &company.Admins, &company.Hrs, &company.Balance); err != nil {
			return nil, err
		}
		companies = append(companies, company)
	}

	if err := rows.Err(); err != nil {
		return nil, err
	}

	return companies, nil
}

func (r *CompanyRepository) DeleteCompany(ctx context.Context, id int) error {
	const query = `
		DELETE FROM Companies WHERE id = $1 
	`

	_, err := r.DB.Exec(ctx, query, id)

	return err
}

func (r *CompanyRepository) ReduceBalance(ctx context.Context, value int, id int) error {
	const query = `
		UPDATE Companies SET balance = balance - $1 WHERE id = $2
	`

	_, err := r.DB.Exec(ctx, query, value, id)

	return err
}

func (r *CompanyRepository) IncreaseBalance(ctx context.Context, value int, id int) error {
	const query = `
		UPDATE Companies SET balance = balance + $1 WHERE id = $2
	`

	_, err := r.DB.Exec(ctx, query, value, id)

	return err
}

func (r *CompanyRepository) UpdateCompanyName(ctx context.Context, name string, id int) error {
	const query = `
		UPDATE Companies SET name = $1 WHERE id = $2
	`

	_, err := r.DB.Exec(ctx, query, name, id)

	return err
}

func (r *CompanyRepository) AddAdmin(ctx context.Context, name string, id int) error {
	const query = `
		UPDATE Companies 
		SET admins = array_append(coalesce(admins, '{}'), $1) 
		WHERE id = $2 AND NOT ($1 = ANY(coalesce(admins, '{}')))
	`

	_, err := r.DB.Exec(ctx, query, name, id)

	return err
}

func (r *CompanyRepository) AddHr(ctx context.Context, name string, id int) error {
	const query = `
		UPDATE Companies 
		SET hrs = array_append(coalesce(hrs, '{}'), $1) 
		WHERE id = $2 AND NOT ($1 = ANY(coalesce(hrs, '{}')))
	`

	_, err := r.DB.Exec(ctx, query, name, id)

	return err
}

func (r *CompanyRepository) DeleteAdmin(ctx context.Context, name string, id int) error {
	const query = `
		UPDATE Companies 
		SET admins = array_remove(coalesce(admins, '{}'), $1) 
		WHERE id = $2
	`

	_, err := r.DB.Exec(ctx, query, name, id)

	return err
}

func (r *CompanyRepository) DeleteHr(ctx context.Context, name string, id int) error {
	const query = `
		UPDATE Companies 
		SET hrs = array_remove(coalesce(hrs, '{}'), $1) 
		WHERE id = $2
	`

	_, err := r.DB.Exec(ctx, query, name, id)

	return err
}

func (r *CompanyRepository) IsOwner(ctx context.Context, id int) (bool, error) {
	const query = `
		SELECT owner FROM Companies WHERE id = $1
	`

	_, err := r.DB.Exec(ctx, query, id)

	if err != nil {
		return false, err
	}

	return true, err
}

func (r *CompanyRepository) IsAdmin(ctx context.Context, name string, id int) (bool, error) {
	const query = `
		SELECT ($1 = ANY(coalesce(admins, '{}'))) AS has_admin 
		FROM Companies 
		WHERE id = $2
	`

	_, err := r.DB.Exec(ctx, query, name, id)

	if err != nil {
		return false, err
	}

	return true, err
}
