package config

import (
	"fmt"
	"os"
	"strconv"
	"time"
)

type Config struct {
	Port		int
	Env			string
	Cert 		string
	Key			string

	JWTSecret	string
	JWTAccessExpiration	time.Duration
	JWTRefreshExpiration time.Duration

	AllowedOrigin string
}

func Load() (*Config, error) {
	cfg := &Config{
		JWTSecret: os.Getenv("JWT_SECRET"),
		// AllowedOrigin: getEnv("ADMIN_WEB_ORIGIN", "http://localhost:5175"),
		AllowedOrigin: os.Getenv("ADMIN_WEB_ORIGIN"),
	}

	jwtAccessExpMinutes, err := strconv.Atoi(getEnv("JWT_ACCESS_EXPIRATION_MINUTES", "60"))
	if err != nil {
		return nil, fmt.Errorf("invalid JWT_ACCESS_EXPIRATION_MINUTES: %v", err)
	}

	jwtRefreshExpMinutes, err := strconv.Atoi(getEnv("JWT_REFRESH_EXPIRATION_MINUTES", "21600"))

	if err != nil {
		return nil, fmt.Errorf("invalid JWT_REFRESH_EXPIRATION_MINUTES: %v", err)
	}

	cfg.JWTAccessExpiration = time.Duration(jwtAccessExpMinutes) * time.Minute
	cfg.JWTRefreshExpiration = time.Duration(jwtRefreshExpMinutes) * time.Minute
	
	if err := cfg.validate(); err != nil {
		return nil, err
	}

	return cfg, nil
}

func (c *Config) validate() error {
	var missing []string

	// Ignore for now
	// if c.DatabaseURL == "" {
	// 	missing = append(missing, "DATABASE_URL")
	// }

	if c.JWTSecret == "" {
		missing = append(missing, "JWT_SECRET")
	}

	if len(missing) > 0 {
		return fmt.Errorf("missing required environment vars: %v", missing)
	}

	return nil
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}

	return fallback
}
