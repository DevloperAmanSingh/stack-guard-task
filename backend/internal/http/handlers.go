package http

import (
	"log"
	"strings"
	"time"

	"github.com/DevloperAmanSingh/secret-scanning/internal/linear"
	"github.com/DevloperAmanSingh/secret-scanning/internal/scanner"
	"github.com/DevloperAmanSingh/secret-scanning/internal/storage"

	"github.com/gofiber/fiber/v2"
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

func pingHandler(c *fiber.Ctx) error {
	return c.JSON(fiber.Map{
		"status":  "ok",
		"message": "pong",
	})
}

func scanHandler(c *fiber.Ctx) error {
	var req ScanRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid request"})
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

	return scanAndCreateIssues(c, payload, metadata, req)
}

func scanAndCreateIssues(c *fiber.Ctx, payload string, metadata string, req ScanRequest) error {
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

	return c.JSON(ScanResponse{
		Success: created > 0 && len(errs) == 0,
		Created: created,
		Issues:  respIssues,
		Errors:  errs,
	})
}

func listTicketsHandler(c *fiber.Ctx) error {
	var issues []storage.Issue
	if err := storage.DB.Order("created_at desc").Find(&issues).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "db error"})
	}
	return c.JSON(issues)
}

func resolveHandler(c *fiber.Ctx) error {
	id := c.Params("id")

	if err := linear.CloseIssue(id); err != nil {
		return c.Status(502).JSON(ResolveResponse{
			Success: false,
			ID:      id,
			Status:  "",
			Error:   err.Error(),
		})
	}

	_ = storage.DB.Model(&storage.Issue{}).Where("id = ?", id).Update("status", "resolved").Error

	return c.JSON(ResolveResponse{
		Success: true,
		ID:      id,
		Status:  "resolved",
	})
}
