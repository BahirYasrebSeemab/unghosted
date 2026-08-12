package auth

import (
	"context"
	"errors"
	"fmt"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type UserRepository struct {
	DB *pgxpool.Pool
}

func NewRepository(DB *pgxpool.Pool) *UserRepository {
	return &UserRepository{
		DB: DB,
	}
}

func (r *UserRepository) CreateUser(user User) error {
	ctx := context.Background()

	fmt.Println(user.Name, " ", user.Email, " ", user.Password, " ", user.Companies)

	_, err := r.DB.Exec(ctx, `INSERT INTO users
		(Name, Email , Password , Companies)
		VALUES ($1 , $2 , $3 , $4)
	`, user.Name, user.Email, user.Password, user.Companies)

	if err != nil {
		return err
	}

	_, err = r.DB.Exec(ctx, `DELETE FROM temp_users WHERE Email = $1`, user.Email)

	if err != nil {
		return err
	}

	return nil
}

func (r *UserRepository) CreateTempUser(tempUser Temp_user) error {
	ctx := context.Background()

	var Email string
	err := r.DB.QueryRow(ctx, `SELECT Email FROM temp_users WHERE Email = $1`, tempUser.Email).Scan(&Email)
	if err != nil && !errors.Is(err, pgx.ErrNoRows) {
		return err
	}

	if Email != "" {
		return errors.New("We already send the code")
	}

	Email = ""

	err = r.DB.QueryRow(ctx, `SELECT Email FROM users WHERE Email = $1`, tempUser.Email).Scan(&Email)

	if err != nil && !errors.Is(err, pgx.ErrNoRows) {
		return err
	}

	if Email != "" {
		return errors.New("User with this data already exists")
	}

	_, err = r.DB.Exec(ctx, `INSERT INTO temp_users
		(Name , Email , Code , Password , Finish_time)
		VALUES ($1 , $2 , $3 , $4 , $5)
	`, tempUser.Name, tempUser.Email, tempUser.Code, tempUser.Password, tempUser.Finish_time)

	if err != nil {
		return err
	}
	return nil
}

func (r *UserRepository) FindCode(ConfirmEmail string) (int, error) {
	ctx := context.Background()

	var Code int

	err := r.DB.QueryRow(ctx, `SELECT Code FROM temp_users WHERE Email = $1`, ConfirmEmail).Scan(&Code)

	if err != nil && !errors.Is(err, pgx.ErrNoRows) {
		return 0, err
	}

	if Code == 0 {
		return 0, errors.New("User with this data already doesn`t exist")
	}

	return Code, nil
}

func (r *UserRepository) GetUsersData(UserEmail string) (User, error) {
	ctx := context.Background()

	var user User

	err := r.DB.QueryRow(ctx, `SELECT Name , Email , Password FROM temp_users WHERE Email = $1`, UserEmail).
		Scan(&user.Name, &user.Email, &user.Password)

	if err != nil {
		return User{}, err
	}

	return user, err
}

