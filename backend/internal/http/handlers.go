package http

import (
	"encoding/json"
	"io"
	"log"
	"net/http"
	"strings"
	"time"

	"github.com/DevloperAmanSingh/secret-scanning/internal/linear"
	"github.com/DevloperAmanSingh/secret-scanning/internal/scanner"
	"github.com/DevloperAmanSingh/secret-scanning/internal/storage"

	"github.com/gorilla/mux"
)


type ScanRequest struct {
	Content string `json:"content"`
	Text    string `json:"text"`
	Repo    string `json:"repo,omitempty"`
	Commit  string `json:"commit,omitempty"`
	Channel string `json:"channel,omitempty"`
	File    string `json:"file,omitempty"`
}

type ScanResponse struct {
	Success bool             `json:"success"`
	Created int              `json:"created"`
	Issues  []map[string]any `json:"issues"`
	Errors  []string         `json:"errors"`
}

type ResolveResponse struct {
	Success bool   `json:"success"`
	ID      string `json:"id"`
	Status  string `json:"status"`
	Error   string `json:"error,omitempty"`
}

func scanHandler(w http.ResponseWriter, r *http.Request) {
	var req ScanRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid request", http.StatusBadRequest)
		return
	}

	payload := req.Content
	source := "content"
	if payload == "" {
		payload = req.Text
		source = "text"
	}
	log.Printf("/scan received: source=%s payload_len=%d", source, len(payload))

	metaLines := []string{}
	if req.Repo != "" {
		metaLines = append(metaLines, "Repository: "+req.Repo)
	}
	if req.Commit != "" {
		metaLines = append(metaLines, "Commit: "+req.Commit)
	}
	if req.Channel != "" {
		metaLines = append(metaLines, "Channel: "+req.Channel)
	}
	if req.File != "" {
		metaLines = append(metaLines, "File: "+req.File)
	}
	metadata := strings.Join(metaLines, "\n")

	scanAndCreateIssues(w, payload, metadata, req)
}

func scanFileHandler(w http.ResponseWriter, r *http.Request) {
	if err := r.ParseMultipartForm(16 << 20); err != nil {
		http.Error(w, "invalid multipart form", http.StatusBadRequest)
		return
	}
	file, header, err := r.FormFile("file")
	if err != nil {
		http.Error(w, "file required", http.StatusBadRequest)
		return
	}
	defer file.Close()
	buf, err := io.ReadAll(file)
	if err != nil {
		http.Error(w, "failed to read file", http.StatusInternalServerError)
		return
	}
	repo := r.FormValue("repo")
	commit := r.FormValue("commit")
	channel := r.FormValue("channel")
	path := r.FormValue("file")
	if path == "" && header != nil {
		path = header.Filename
	}
	metaLines := []string{}
	if repo != "" {
		metaLines = append(metaLines, "Repository: "+repo)
	}
	if commit != "" {
		metaLines = append(metaLines, "Commit: "+commit)
	}
	if channel != "" {
		metaLines = append(metaLines, "Channel: "+channel)
	}
	if path != "" {
		metaLines = append(metaLines, "File: "+path)
	}
	metadata := strings.Join(metaLines, "\n")

	req := ScanRequest{Repo: repo, Commit: commit, Channel: channel, File: path}
	scanAndCreateIssues(w, string(buf), metadata, req)
}

func scanAndCreateIssues(w http.ResponseWriter, payload string, metadata string, req ScanRequest) {
	findings := scanner.Scan(payload)
	log.Printf("/scan findings: count=%d", len(findings))

	created := 0
	respIssues := []map[string]any{}
	errs := []string{}

	for _, f := range findings {
		issueID, err := linear.CreateIssue(f.Type, metadata, time.Now())
		if err != nil {
			log.Printf("linear create issue failed: type=%s err=%v", f.Type, err)
			errs = append(errs, err.Error())
			continue
		}
		if issueID == "" {
			log.Printf("linear returned empty issue id; skipping db storage")
			continue
		}
		issue := storage.Issue{
			ID:      issueID,
			Type:    f.Type,
			Status:  "active",
			Repo:    req.Repo,
			Commit:  req.Commit,
			Channel: req.Channel,
			File:    req.File,
		}
		if err := storage.DB.Create(&issue).Error; err != nil {
			log.Printf("db create issue failed: id=%s err=%v", issueID, err)
			errs = append(errs, "db error")
			continue
		}
		respIssues = append(respIssues, map[string]any{"id": issueID, "type": f.Type})
		created++
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(ScanResponse{
		Success: created > 0 && len(errs) == 0,
		Created: created,
		Issues:  respIssues,
		Errors:  errs,
	})
}

func listTicketsHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	var issues []storage.Issue
	if err := storage.DB.Order("created_at desc").Find(&issues).Error; err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		w.Write([]byte("db error"))
		return
	}
	json.NewEncoder(w).Encode(issues)
}

func resolveHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id := vars["id"]

	if err := linear.CloseIssue(id); err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusBadGateway)
		json.NewEncoder(w).Encode(ResolveResponse{Success: false, ID: id, Status: "", Error: err.Error()})
		return
	}

	_ = storage.DB.Model(&storage.Issue{}).Where("id = ?", id).Update("status", "resolved").Error

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(ResolveResponse{Success: true, ID: id, Status: "resolved"})
}
