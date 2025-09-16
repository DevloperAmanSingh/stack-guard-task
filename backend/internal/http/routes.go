package http

import (
	"net/http"

	"github.com/gorilla/mux"
)

func simpleCORS(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "*")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}

func SetupRoutes() *mux.Router {
	r := mux.NewRouter()
	r.Use(simpleCORS)

	r.HandleFunc("/scan", scanHandler).Methods("POST")
	r.HandleFunc("/scan/file", scanFileHandler).Methods("POST")
	r.HandleFunc("/tickets", listTicketsHandler).Methods("GET")
	r.HandleFunc("/resolve/{id}", resolveHandler).Methods("POST")

	return r
}
