package auth

import "time"

type LogInData struct {
	Email    string `json:"Email"`
	Password string `json:"Password"`
}
type ConfirmMessage struct {
	Email string `json:"Email"`
	Code  int    `json:"Code"`
}
type NotReadyUser struct {
	Name     string `json:"Name"`
	Email    string `json:"Email"`
	Password string `json:"Password"`
}

type Temp_user struct {
	Name        string    `json:"Name"`
	Email       string    `json:"Email"`
	Password    string    `json:"Password"`
	Code        int       `json:"Code"`
	Finish_time time.Time `json:"Finish_time"`
}

type User struct {
	Name      string   `json:"Name"`
	Email     string   `json:"Email"`
	Password  string   `json:"Password"`
	Companies []string `json:"Companies"`
}

type Companies struct {
	Name    string   `json:"Name"`
	Owner   string   `json:"Owner"`
	Admins  []string `json:"Admins"`
	Hrs     []string `json:"Hrs"`
	Balance int      `json:"Balance"`
}
