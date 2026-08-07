package auth

import (
	"crypto/rand"
	"errors"
	"fmt"
	"math/big"
	"time"

	"golang.org/x/crypto/argon2"
	"gopkg.in/gomail.v2"
)

type UserService struct {
	repo *UserRepository
}

func NewUserService(repo *UserRepository) *UserService {
	return &UserService{
		repo: repo,
	}
}

func (s *UserService) CreateUser(ConfirmMessage ConfirmMessage) error {
	Code, err := s.repo.FindCode(ConfirmMessage.Email)
	if err != nil {
		return err
	}

	if Code != ConfirmMessage.Code {
		return errors.New("Incorrect confirmation Code")
	}

	UserData, err := s.repo.GetUsersData(ConfirmMessage.Email)
	UserData.Companies = []string{}
	return s.repo.CreateUser(UserData)
}

func (s *UserService) CreateTempUser(NotReadyUser NotReadyUser) error {
	var tempUser Temp_user

	hashed_password, err := HashPassword(NotReadyUser.Password)

	if err != nil {
		return err
	}

	n, err := rand.Int(rand.Reader, big.NewInt(900000))
	if err != nil {
		return err
	}
	code := n.Int64() + 100000

	now := time.Now()
	_ = now.Add(10 * time.Minute)
	if err != nil {
		return err
	}

	tempUser.Email = NotReadyUser.Email
	tempUser.Name = NotReadyUser.Name
	tempUser.Password = hashed_password
	tempUser.Code = int(code)
	tempUser.Finish_time = now

	mail_meesage := fmt.Sprintf("Hello %s from LCC\n here is you app verification code: %v", tempUser.Name, code)
	m := gomail.NewMessage()
	m.SetHeader("From", "app75490@gmail.com")
	m.SetHeader("To", tempUser.Email)
	m.SetHeader("Subject", "App verifycation")
	m.SetBody("text/html", fmt.Sprintf(`<h1 class="header" style = "color:blue">%s</h1>`, mail_meesage))

	send := gomail.NewDialer("smtp.gmail.com", 587, "app75490@gmail.com", "znvh weto comb wkkd ")
	err = send.DialAndSend(m)
	if err != nil {
		return err
	}

	return s.repo.CreateTempUser(tempUser)
}

func HashPassword(password string) (string, error) {
	salt := make([]byte, 16)

	if _, err := rand.Read(salt); err != nil {
		return "", err
	}

	hash := argon2.IDKey(
		[]byte(password),
		salt,
		1,       // iterations
		64*1024, // memory: 64 MB
		4,       // threads
		32,      // key length
	)

	return fmt.Sprintf(
		"%x:%x",
		salt,
		hash,
	), nil
}
