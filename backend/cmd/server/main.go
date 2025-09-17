package main

import (
	"log"

	apphttp "github.com/DevloperAmanSingh/secret-scanning/internal/http"
	"github.com/DevloperAmanSingh/secret-scanning/internal/storage"
)

func main() {
	if err := storage.Connect(); err != nil {
		log.Fatalf("db connect error: %v", err)
	}
	if err := storage.Migrate(); err != nil {
		log.Fatalf("db migrate error: %v", err)
	}

	app := apphttp.SetupRoutes()
	log.Println("🚀 Backend API running on :8080")
	log.Fatal(app.Listen(":8080"))
}
