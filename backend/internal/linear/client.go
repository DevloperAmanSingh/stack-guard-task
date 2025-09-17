package linear

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"regexp"
	"strings"
	"time"
)

var linearURL = "https://api.linear.app/graphql"
var uuidPattern = regexp.MustCompile(`^[0-9a-fA-F-]{36}$`)

func severityForType(t string) string {
	lt := strings.ToLower(t)
	if strings.Contains(lt, "aws") || strings.Contains(lt, "stripe") || strings.Contains(lt, "jwt") {
		return "high"
	}
	if strings.Contains(lt, "github") || strings.Contains(lt, "slack") || strings.Contains(lt, "google") {
		return "medium"
	}
	return "low"
}

func CreateIssue(secretType, metadata string, ts time.Time) (string, error) {
	token := os.Getenv("LINEAR_API_KEY")
	teamID := os.Getenv("LINEAR_TEAM_ID")
	if token == "" || teamID == "" {
		return "", fmt.Errorf("missing LINEAR_API_KEY or LINEAR_TEAM_ID")
	}
	if !uuidPattern.MatchString(teamID) {
		return "", fmt.Errorf("LINEAR_TEAM_ID must be a UUID")
	}

	// Build structured, redaction-safe description
	desc := fmt.Sprintf("Severity: %s\nType: %s\nDetected: %s\n\nContext:\n%s\n\nRemediation:\n- Immediately revoke/rotate the credential.\n- Remove the secret from source/logs and force-push if in VCS.\n- Audit usage and monitor for abuse.\n\nNotes:\n- Values are not stored or logged.\n- API key: **** (redacted)",
		severityForType(secretType),
		secretType,
		ts.Format(time.RFC3339),
		metadata,
	)

	query := `
	mutation IssueCreate($input: IssueCreateInput!) {
		issueCreate(input: $input) {
			success
			issue { id identifier }
		}
	}`

	payload := map[string]interface{}{
		"query": query,
		"variables": map[string]interface{}{
			"input": map[string]interface{}{
				"title":       fmt.Sprintf("[%s] Secret detected: %s", severityForType(secretType), secretType),
				"description": desc,
				"teamId":      teamID,
			},
		},
	}

	data, _ := json.Marshal(payload)

	req, _ := http.NewRequest("POST", linearURL, bytes.NewBuffer(data))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", token)

	client := &http.Client{}
	log.Printf("linear: create issue request: team=%s type=%s", teamID, secretType)
	resp, err := client.Do(req)
	if err != nil {
		log.Printf("linear: request error: %v", err)
		return "", err
	}
	defer resp.Body.Close()

	limited := io.LimitedReader{R: resp.Body, N: 8192}
	bodyBytes, _ := io.ReadAll(&limited)
	log.Printf("linear: create issue response: status=%d", resp.StatusCode)

	if resp.StatusCode != 200 {
		return "", fmt.Errorf("linear API error: %d", resp.StatusCode)
	}

	var graph struct {
		Data struct {
			IssueCreate struct {
				Issue struct {
					ID         string `json:"id"`
					Identifier string `json:"identifier"`
				} `json:"issue"`
			} `json:"issueCreate"`
		} `json:"data"`
		Errors []struct {
			Message string `json:"message"`
		} `json:"errors"`
	}
	if err := json.Unmarshal(bodyBytes, &graph); err != nil {
		return "", err
	}
	if len(graph.Errors) > 0 {
		return "", fmt.Errorf("linear GraphQL error: %s", graph.Errors[0].Message)
	}
	issueID := graph.Data.IssueCreate.Issue.ID
	if issueID == "" {
		return "", fmt.Errorf("linear returned empty issue id")
	}

	return issueID, nil
}

func getCompletedStateID(token, teamID string) (string, error) {
	query := `
	query($teamId: ID!) {
		workflowStates(filter: { team: { id: { eq: $teamId } } }) {
			nodes { id name type }
		}
	}`
	payload := map[string]interface{}{
		"query": query,
		"variables": map[string]interface{}{
			"teamId": teamID,
		},
	}
	data, _ := json.Marshal(payload)

	req, _ := http.NewRequest("POST", linearURL, bytes.NewBuffer(data))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", token)

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	limited := io.LimitedReader{R: resp.Body, N: 8192}
	bodyBytes, _ := io.ReadAll(&limited)
	if resp.StatusCode != 200 {
		return "", fmt.Errorf("linear API error: %d", resp.StatusCode)
	}
	var graph struct {
		Data struct {
			WorkflowStates struct {
				Nodes []struct {
					ID   string `json:"id"`
					Name string `json:"name"`
					Type string `json:"type"`
				} `json:"nodes"`
			} `json:"workflowStates"`
		} `json:"data"`
		Errors []struct {
			Message string `json:"message"`
		} `json:"errors"`
	}
	if err := json.Unmarshal(bodyBytes, &graph); err != nil {
		return "", err
	}
	if len(graph.Errors) > 0 {
		return "", fmt.Errorf("linear GraphQL error: %s", graph.Errors[0].Message)
	}
	for _, st := range graph.Data.WorkflowStates.Nodes {
		if st.Type == "completed" {
			return st.ID, nil
		}
	}
	return "", fmt.Errorf("no completed state found for team")
}

func CloseIssue(id string) error {
	token := os.Getenv("LINEAR_API_KEY")
	teamID := os.Getenv("LINEAR_TEAM_ID")
	if token == "" {
		return fmt.Errorf("missing LINEAR_API_KEY")
	}
	if teamID == "" || !uuidPattern.MatchString(teamID) {
		return fmt.Errorf("LINEAR_TEAM_ID must be a UUID")
	}
	stateID, err := getCompletedStateID(token, teamID)
	if err != nil {
		return err
	}

	query := `
	mutation CloseIssue($id: String!, $input: IssueUpdateInput!) {
		issueUpdate(id: $id, input: $input) { success }
	}`

	payload := map[string]interface{}{
		"query": query,
		"variables": map[string]interface{}{
			"id": id,
			"input": map[string]interface{}{
				"stateId": stateID,
			},
		},
	}

	data, _ := json.Marshal(payload)
	req, _ := http.NewRequest("POST", linearURL, bytes.NewBuffer(data))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", token)

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	limited := io.LimitedReader{R: resp.Body, N: 8192}
	bodyBytes, _ := io.ReadAll(&limited)
	if resp.StatusCode != 200 {
		return fmt.Errorf("linear API error: %d", resp.StatusCode)
	}
	var graph struct {
		Data struct {
			IssueUpdate struct {
				Success bool `json:"success"`
			} `json:"issueUpdate"`
		} `json:"data"`
		Errors []struct {
			Message string `json:"message"`
		} `json:"errors"`
	}
	if err := json.Unmarshal(bodyBytes, &graph); err != nil {
		return err
	}
	if len(graph.Errors) > 0 {
		return fmt.Errorf("linear GraphQL error: %s", graph.Errors[0].Message)
	}
	if !graph.Data.IssueUpdate.Success {
		return fmt.Errorf("failed to close issue")
	}
	return nil
}
