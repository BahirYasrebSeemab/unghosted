package main

import (
	// "encoding/json"
	"fmt"
	"go-server/internal/auth"
	"go-server/internal/database"
	"go-server/internal/router"
	"html"
	"log"
	"net/http"
	// "strconv"
)

func main() {
	http.HandleFunc("/", indexHandler)
	DB, err := database.Connect_to_db()
	if err != nil {
		log.Fatal(err)
	}

	repo := auth.NewRepository(DB)

	userService := auth.NewUserService(repo)

	userHandler := auth.NewUserHandler(userService)

	createUserRouter := router.CreateUserRouter(userHandler)

	fmt.Println("Server is running at :8080")
	log.Fatal(http.ListenAndServe(":8080", createUserRouter))
}

func indexHandler(w http.ResponseWriter, r *http.Request) {
	/* req, err := strconv.Atoi(r.URL.Path)
	if err != nil {
		http.Error(w, "Invalid request", http.StatusBadRequest)
		return
	} */

	switch r.Method {
	case "GET":
		handleGetIndex(w, r)
	default:
		http.Error(w, "Unrecognized method", http.StatusMethodNotAllowed)
	}
}

func handleGetIndex(w http.ResponseWriter, r *http.Request) {
	fmt.Fprintf(w, "Hello, %q", html.EscapeString(r.URL.Path))
}
