package hashing

import (
	"crypto/rand"
	"crypto/subtle"
	"encoding/base64"
	"fmt"
	"strings"

	"golang.org/x/crypto/argon2"
)

func CreateHash(password string) (string, error) {
	salt := make([]byte, 16)

	if _, err := rand.Read(salt); err != nil {
		return "", err
	}

	const (
		memory		= 64 * 1024
		iterations	= 1
		parallelism = 4
		keyLength	= 32
	)

	hash := argon2.IDKey(
		[]byte(password),
		salt,
		iterations,
		memory,
		parallelism,
		keyLength,
	)

	encoded := fmt.Sprintf(
		"$argon2id$v=%d$m=%d,t=%d,p=%d$%s$%s",
		argon2.Version, memory, iterations, parallelism,
		base64.RawStdEncoding.EncodeToString(salt),
		base64.RawStdEncoding.EncodeToString(hash),
	)

	// return fmt.Sprintf(
	// 	"%x:%x",
	// 	salt,
	// 	hash,
	// ), nil

	return encoded, nil
}

func ValidateHash(password, stored string) (bool, error) {
	parts := strings.Split(stored, "$")
	if len(parts) != 6 {
		return false, fmt.Errorf("Invalid stored hash format")
	}

	var version int
	if _, err := fmt.Sscanf(parts[2], "v=%d", &version); err != nil {
		return false, err
	}

	var memory, iterations uint32
	var parallelism uint8
	if _, err := fmt.Sscanf(parts[3], "m=%d,t=%d,p=%d", &memory, &iterations, &parallelism); err != nil {
		return false, err
	}


	salt, err := base64.RawStdEncoding.DecodeString(parts[4])
	if err != nil {
		return false, fmt.Errorf("decode salt: %w", err)
	}

	wantHash, err := base64.RawStdEncoding.DecodeString(parts[5])
	if err != nil {
		return false, fmt.Errorf("decode hash: %w", err)
	}

	gotHash := argon2.IDKey(
		[]byte(password),
		salt,
		iterations,
		memory,
		parallelism,
		uint32(len(wantHash)),
	)

	if subtle.ConstantTimeCompare(wantHash, gotHash) == 1 {
		return true, nil
	}

	return false, nil
}
