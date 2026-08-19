package auth

import (
	"time"

	"github.com/google/uuid"
)

type LogInData struct {
	Email string `json:"Email" validate:"email, require"`
	Password string `json:"-" validate:"required, min=6"`
}

type AuthResponse struct {
	Token			string `json:"token"`
	RefreshToken	string `json:"refresh_token"`
	User			User   `json:"user"`
}

type RefreshToken struct {
	ID			uuid.UUID 	`json:"id"`
	Email		string		`json:"email"`
	TokenHash	string		`json:"-"`
	ExpiresAt	time.Time	`json:"expires_at"` 
	RevokedAt	*time.Time	`json:"revoked_at,omitempty"` 
	CreatedAt	time.Time	`json:"created_at"` 

}

type ConfirmMessage struct {
	Email string `json:"Email" validate:"email, require"`
	Code  int    `json:"Code"`
}

type NotReadyUser struct {
	Name     string `json:"Name" validate:"required,min=2,max=50"`
	Email    string `json:"Email" validate:"email,require"`
	Password string `json:"-" validate:"required,min=6"`
}

// Users who didn't confirm their account yet
type TempUser struct {
	Name      string   `json:"Name" validate:"required,min=2,max=50"`
	Email     string   `json:"Email" validate:"email,required"`
	Password  string   `json:"-" validate:"required,min=6"`
	Code        int       `json:"Code"`
	Finish_time time.Time `json:"Finish_time"`
}


type User struct {
	Name      		string   `json:"Name" validate:"required,min=2,max=50"`
	Email     		string   `json:"Email" validate:"email,required"`
	Password  		string   `json:"-" validate:"required,min=6"`
	Companies 		[]string `json:"Companies"`

	CreatedAt		time.Time	`json:"CreatedAt"`
	UpdatedAt		time.Time	`json:"UpdatedAt"`
}

type Companies struct {
	Name	string   `json:"Name" validate:"required,min=2,max=50"`
	Owner   string   `json:"Owner" validate:"required,min=2,max=50"`
	Admins  []string `json:"Admins"`
	Hrs     []string `json:"Hrs"`
	Balance int      `json:"Balance"`

	CreatedAt		time.Time	`json:"CreatedAt"`
	UpdatedAt		time.Time	`json:"UpdatedAt"`
}
