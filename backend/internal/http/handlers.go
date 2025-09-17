package http

import (
	"crypto/sha256"
	"encoding/hex"
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
	Success    bool             `json:"success"`
	Created    int              `json:"created"`
	Resolved   int              `json:"resolved"`
	Duplicates int              `json:"duplicates"`
	Issues     []map[string]any `json:"issues"`
	Errors     []string         `json:"errors"`
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

	// First, check for auto-resolution: close issues that are no longer detected
	resolvedCount := 0
	if err := autoResolveIssues(payload, req); err != nil {
		log.Printf("auto-resolve failed: %v", err)
	} else {
		// Count resolved issues for this scan
		var resolved []storage.Issue
		query := storage.DB.Where("status = ?", "resolved")
		if req.Repo != "" {
			query = query.Where("repo = ?", req.Repo)
		}
		if req.Channel != "" {
			query = query.Where("channel = ?", req.Channel)
		}
		if req.File != "" {
			query = query.Where("file = ?", req.File)
		}
		query.Where("updated_at > ?", time.Now().Add(-time.Minute)).Find(&resolved)
		resolvedCount = len(resolved)
	}

	created := 0
	duplicates := 0
	respIssues := []map[string]any{}
	errs := []string{}

	currentFingerprints := map[string]struct{}{}
	for _, f := range findings {
		fp := fingerprint(req, f.Value, f.Type)
		currentFingerprints[fp] = struct{}{}
	}

	for _, f := range findings {
		fp := fingerprint(req, f.Value, f.Type)

		var existingIssue storage.Issue
		result := storage.DB.Where("fingerprint = ? AND status = ?", fp, "active").First(&existingIssue)

		if result.Error == nil {
			log.Printf("duplicate issue detected: type=%s fp=%s, skipping creation", f.Type, fp)
			respIssues = append(respIssues, map[string]any{
				"id":      existingIssue.ID,
				"type":    f.Type,
				"status":  "duplicate",
				"message": "Issue already exists",
			})
			duplicates++
			continue
		}

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
			ID:          issueID,
			Type:        f.Type,
			Status:      "active",
			Repo:        req.Repo,
			Commit:      req.Commit,
			Channel:     req.Channel,
			File:        req.File,
			Content:     payload,
			Fingerprint: fp,
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
		Success:    created > 0 && len(errs) == 0,
		Created:    created,
		Resolved:   resolvedCount,
		Duplicates: duplicates,
		Issues:     respIssues,
		Errors:     errs,
	})
}

func autoResolveIssues(currentContent string, req ScanRequest) error {
	// Get all active issues for this repo/channel/file context
	var activeIssues []storage.Issue
	query := storage.DB.Where("status = ?", "active")

	
	hasContext := false

	if req.Repo != "" {
		query = query.Where("repo = ?", req.Repo)
		hasContext = true
	}
	if req.Channel != "" {
		query = query.Where("channel = ?", req.Channel)
		hasContext = true
	}
	if req.File != "" {
		query = query.Where("file = ?", req.File)
		hasContext = true
	}

	if !hasContext {
		log.Printf("auto-resolve skipped: no context provided (repo/channel/file)")
		return nil
	}

	if err := query.Find(&activeIssues).Error; err != nil {
		return err
	}

	resolvedCount := 0
 // making fingerprint
	currentFindings := scanner.Scan(currentContent)
	presentFingerprints := map[string]struct{}{}
	for _, f := range currentFindings {
		fp := fingerprint(req, f.Value, f.Type)
		presentFingerprints[fp] = struct{}{}
	}

	for _, issue := range activeIssues {
		// If this issue's fingerprint is NOT present now, resolve it
		if _, ok := presentFingerprints[issue.Fingerprint]; !ok {
			log.Printf("auto-resolving issue: %s (type: %s) - fingerprint not present", issue.ID, issue.Type)

			if err := linear.CloseIssue(issue.ID); err != nil {
				log.Printf("failed to close issue in Linear: %v", err)
				continue
			}

			if err := storage.DB.Model(&issue).Update("status", "resolved").Error; err != nil {
				log.Printf("failed to update issue status: %v", err)
				continue
			}

			resolvedCount++
		}
	}

	if resolvedCount > 0 {
		log.Printf("auto-resolved %d issues", resolvedCount)
	}

	return nil
}

// fingerprint creates a stable hash from context + type + secret value
func fingerprint(req ScanRequest, value string, secretType string) string {
	h := sha256.New()
	h.Write([]byte(req.Repo))
	h.Write([]byte("|"))
	h.Write([]byte(req.Channel))
	h.Write([]byte("|"))
	h.Write([]byte(req.File))
	h.Write([]byte("|"))
	h.Write([]byte(secretType))
	h.Write([]byte("|"))
	h.Write([]byte(value))
	sum := h.Sum(nil)
	return hex.EncodeToString(sum)
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
