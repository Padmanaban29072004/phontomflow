// PHANTOM-Flow Security Validation Engine
package security

import (
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"regexp"
	"strings"
	"time"
)

type Validator struct {
	patterns map[string]*regexp.Regexp
	rules    []ValidationRule
}

type ValidationRule struct {
	Name        string
	Pattern     string
	Severity    Severity
	Description string
	Enabled     bool
}

type Severity int

const (
	Low Severity = iota
	Medium
	High
	Critical
)

type ValidationResult struct {
	Valid     bool
	Score     float64
	Violations []Violation
	Timestamp time.Time
}

type Violation struct {
	Rule        string
	Severity    Severity
	Description string
	Location    string
	Context     string
}

func NewValidator() *Validator {
	v := &Validator{
		patterns: make(map[string]*regexp.Regexp),
		rules:    make([]ValidationRule, 0),
	}
	v.initializeDefaultRules()
	return v
}

func (v *Validator) initializeDefaultRules() {
	defaultRules := []ValidationRule{
		{
			Name:        "SQL Injection Detection",
			Pattern:     `(?i)(union|select|insert|update|delete|drop|create|alter|exec|execute)`,
			Severity:    High,
			Description: "Detects potential SQL injection attempts",
			Enabled:     true,
		},
		{
			Name:        "XSS Pattern Detection",
			Pattern:     `(?i)(<script|javascript:|on\w+\s*=)`,
			Severity:    Medium,
			Description: "Detects potential XSS attack patterns",
			Enabled:     true,
		},
		{
			Name:        "Path Traversal Detection",
			Pattern:     `\.\./|\.\.\\|%2e%2e%2f|%2e%2e%5c`,
			Severity:    High,
			Description: "Detects directory traversal attempts",
			Enabled:     true,
		},
		{
			Name:        "Command Injection Detection",
			Pattern:     `[;&|` + "`" + `$()]`,
			Severity:    Critical,
			Description: "Detects potential command injection characters",
			Enabled:     true,
		},
		{
			Name:        "Suspicious Headers",
			Pattern:     `(?i)(x-forwarded-for|x-real-ip|x-cluster-client-ip)`,
			Severity:    Low,
			Description: "Detects suspicious proxy headers",
			Enabled:     true,
		},
	}

	for _, rule := range defaultRules {
		v.AddRule(rule)
	}
}

func (v *Validator) AddRule(rule ValidationRule) error {
	compiled, err := regexp.Compile(rule.Pattern)
	if err != nil {
		return fmt.Errorf("invalid regex pattern for rule %s: %v", rule.Name, err)
	}
	
	v.patterns[rule.Name] = compiled
	v.rules = append(v.rules, rule)
	return nil
}

func (v *Validator) ValidateInput(input string, inputType string) ValidationResult {
	result := ValidationResult{
		Valid:     true,
		Score:     0.0,
		Violations: make([]Violation, 0),
		Timestamp: time.Now(),
	}

	for _, rule := range v.rules {
		if !rule.Enabled {
			continue
		}

		pattern, exists := v.patterns[rule.Name]
		if !exists {
			continue
		}

		if pattern.MatchString(input) {
			violation := Violation{
				Rule:        rule.Name,
				Severity:    rule.Severity,
				Description: rule.Description,
				Location:    inputType,
				Context:     v.extractContext(input, pattern),
			}
			
			result.Violations = append(result.Violations, violation)
			result.Valid = false
			result.Score += float64(rule.Severity) * 0.25
		}
	}

	if result.Score > 1.0 {
		result.Score = 1.0
	}

	return result
}

func (v *Validator) extractContext(input string, pattern *regexp.Regexp) string {
	matches := pattern.FindAllString(input, -1)
	if len(matches) > 0 {
		return strings.Join(matches, ", ")
	}
	return ""
}

func (v *Validator) ValidateRequest(req *SecurityRequest) ValidationResult {
	result := ValidationResult{
		Valid:     true,
		Score:     0.0,
		Violations: make([]Violation, 0),
		Timestamp: time.Now(),
	}

	// Validate URL path
	pathResult := v.ValidateInput(req.Path, "path")
	result.Violations = append(result.Violations, pathResult.Violations...)
	result.Score += pathResult.Score * 0.3

	// Validate headers
	for name, value := range req.Headers {
		headerResult := v.ValidateInput(value, fmt.Sprintf("header:%s", name))
		result.Violations = append(result.Violations, headerResult.Violations...)
		result.Score += headerResult.Score * 0.2
	}

	// Validate body
	if req.Body != "" {
		bodyResult := v.ValidateInput(req.Body, "body")
		result.Violations = append(result.Violations, bodyResult.Violations...)
		result.Score += bodyResult.Score * 0.5
	}

	if result.Score > 1.0 {
		result.Score = 1.0
	}

	result.Valid = len(result.Violations) == 0
	return result
}

func (v *Validator) CalculateThreatScore(result ValidationResult) float64 {
	if len(result.Violations) == 0 {
		return 0.0
	}

	score := 0.0
	for _, violation := range result.Violations {
		score += float64(violation.Severity) * 0.25
	}

	return score
}

func (v *Validator) GenerateReport(result ValidationResult) string {
	if result.Valid {
		return "Validation passed - no security issues detected"
	}

	report := fmt.Sprintf("Security validation failed (Score: %.2f)\n", result.Score)
	report += fmt.Sprintf("Violations found: %d\n\n", len(result.Violations))

	for i, violation := range result.Violations {
		report += fmt.Sprintf("%d. %s [%s]\n", i+1, violation.Description, v.severityString(violation.Severity))
		report += fmt.Sprintf("   Location: %s\n", violation.Location)
		if violation.Context != "" {
			report += fmt.Sprintf("   Context: %s\n", violation.Context)
		}
		report += "\n"
	}

	return report
}

func (v *Validator) severityString(severity Severity) string {
	switch severity {
	case Low:
		return "LOW"
	case Medium:
		return "MEDIUM"
	case High:
		return "HIGH"
	case Critical:
		return "CRITICAL"
	default:
		return "UNKNOWN"
	}
}

type SecurityRequest struct {
	Path    string
	Headers map[string]string
	Body    string
	Method  string
	IP      string
}

func (v *Validator) HashInput(input string) string {
	hash := sha256.Sum256([]byte(input))
	return hex.EncodeToString(hash[:])
}

func (v *Validator) GetRuleCount() int {
	return len(v.rules)
}

func (v *Validator) GetEnabledRules() []ValidationRule {
	enabled := make([]ValidationRule, 0)
	for _, rule := range v.rules {
		if rule.Enabled {
			enabled = append(enabled, rule)
		}
	}
	return enabled
}
