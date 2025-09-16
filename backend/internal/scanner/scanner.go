package scanner

import (
	"log"
	"regexp"
)

type Finding struct {
	Type     string `json:"type"`
	Value    string `json:"value"`
	Severity string `json:"severity"`
}

var regexPatterns = map[string]*regexp.Regexp{
	"AWSAccessKey":    regexp.MustCompile(`AKIA[0-9A-Z]{16}`),
	"AWSSecretKey":    regexp.MustCompile(`(?i)aws_secret_access_key\s*[:=]\s*['\"]?[A-Za-z0-9/+=]{40}['\"]?`),
	"JWT":             regexp.MustCompile(`eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9._-]+\.[a-zA-Z0-9._-]+`),
	"GenericAPIKey":   regexp.MustCompile(`(?i)(api|token|secret)[_-]?key[=:]\s*['\"]?[a-zA-Z0-9-_]{16,}['\"]?`),
	"GithubToken":     regexp.MustCompile(`ghp_[A-Za-z0-9]{36}`),
	"SlackBotToken":   regexp.MustCompile(`xoxb-[0-9]{11}-[0-9]{11,}-[A-Za-z0-9]{24,}`),
	"SlackUserToken":  regexp.MustCompile(`xoxp-[0-9]{11}-[0-9]{11,}-[0-9]{11,}-[A-Za-z0-9]{24,}`),
	"GoogleAPIKey":    regexp.MustCompile(`AIza[0-9A-Za-z\-_]{35}`),
	"StripeSecretKey": regexp.MustCompile(`sk_live_[0-9a-zA-Z]{24}`),
}

func Scan(content string) []Finding {
	findings := []Finding{}
	for name, re := range regexPatterns {
		matches := re.FindAllString(content, -1)
		if len(matches) > 0 {
			log.Printf("scanner: pattern=%s matches=%d sample=%q", name, len(matches), matches[0])
		}
		for _, match := range matches {
			findings = append(findings, Finding{
				Type:     name,
				Value:    match,
				Severity: "high",
			})
		}
	}
	if len(findings) == 0 {
		log.Printf("scanner: no matches found")
	}
	return findings
}
