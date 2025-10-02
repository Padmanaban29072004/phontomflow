// PHANTOM-Flow Threat Analyzer Package
// Advanced threat analysis algorithms and security intelligence

package analyzer

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"math"
	"net"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/sirupsen/logrus"
)

// ThreatAnalyzer provides advanced threat analysis capabilities
type ThreatAnalyzer struct {
	logger          *logrus.Logger
	ipReputationDB  map[string]IPReputationInfo
	signatureDB     map[string]ThreatSignature
	behaviorProfiles map[string]BehaviorProfile
	statisticalModel StatisticalModel
	mlModel         MachineLearningModel
	mutex           sync.RWMutex
}

// IPReputationInfo contains IP reputation data
type IPReputationInfo struct {
	IP            string    `json:"ip"`
	ReputationScore float64 `json:"reputation_score"`
	ThreatTypes   []string  `json:"threat_types"`
	LastSeen      time.Time `json:"last_seen"`
	Sources       []string  `json:"sources"`
	Country       string    `json:"country"`
	ASN           string    `json:"asn"`
	ISP           string    `json:"isp"`
	IsMalicious   bool      `json:"is_malicious"`
	Confidence    float64   `json:"confidence"`
}

// ThreatSignature represents a threat detection signature
type ThreatSignature struct {
	ID          string            `json:"id"`
	Name        string            `json:"name"`
	Pattern     string            `json:"pattern"`
	Regex       *regexp.Regexp    `json:"-"`
	Category    string            `json:"category"`
	Severity    string            `json:"severity"`
	Description string            `json:"description"`
	References  []string          `json:"references"`
	Metadata    map[string]string `json:"metadata"`
	CreatedAt   time.Time         `json:"created_at"`
	UpdatedAt   time.Time         `json:"updated_at"`
	Enabled     bool              `json:"enabled"`
	FalsePositiveRate float64     `json:"false_positive_rate"`
}

// BehaviorProfile represents user behavior patterns
type BehaviorProfile struct {
	UserID          string            `json:"user_id"`
	IPAddress       string            `json:"ip_address"`
	UserAgent       string            `json:"user_agent"`
	RequestPatterns []RequestPattern  `json:"request_patterns"`
	SessionData     SessionData       `json:"session_data"`
	AnomalyScore    float64           `json:"anomaly_score"`
	LastUpdated     time.Time         `json:"last_updated"`
	Features        map[string]float64 `json:"features"`
}

// RequestPattern represents request behavior patterns
type RequestPattern struct {
	Method        string            `json:"method"`
	Path          string            `json:"path"`
	Frequency     int               `json:"frequency"`
	AverageSize   float64           `json:"average_size"`
	TimePattern   []time.Duration   `json:"time_pattern"`
	Headers       map[string]string `json:"headers"`
	Parameters    map[string]string `json:"parameters"`
	ResponseCodes []int             `json:"response_codes"`
}

// SessionData contains session-specific information
type SessionData struct {
	SessionID     string        `json:"session_id"`
	StartTime     time.Time     `json:"start_time"`
	Duration      time.Duration `json:"duration"`
	RequestCount  int           `json:"request_count"`
	BytesTransferred int64      `json:"bytes_transferred"`
	UniqueEndpoints int         `json:"unique_endpoints"`
	ErrorRate     float64       `json:"error_rate"`
	GeographicMovement bool     `json:"geographic_movement"`
}

// StatisticalModel provides statistical analysis
type StatisticalModel struct {
	Baselines     map[string]Baseline     `json:"baselines"`
	Distributions map[string]Distribution `json:"distributions"`
	Correlations  map[string]float64      `json:"correlations"`
	Thresholds    map[string]float64      `json:"thresholds"`
	LastUpdated   time.Time               `json:"last_updated"`
}

// Baseline represents statistical baseline for metrics
type Baseline struct {
	Mean      float64   `json:"mean"`
	Median    float64   `json:"median"`
	StdDev    float64   `json:"std_dev"`
	Min       float64   `json:"min"`
	Max       float64   `json:"max"`
	Percentiles map[int]float64 `json:"percentiles"`
	SampleSize int64     `json:"sample_size"`
	LastUpdate time.Time `json:"last_update"`
}

// Distribution represents probability distribution
type Distribution struct {
	Type       string             `json:"type"`
	Parameters map[string]float64 `json:"parameters"`
	Histogram  []HistogramBucket  `json:"histogram"`
}

// HistogramBucket represents a histogram bucket
type HistogramBucket struct {
	Min   float64 `json:"min"`
	Max   float64 `json:"max"`
	Count int64   `json:"count"`
}

// MachineLearningModel provides ML-based threat detection
type MachineLearningModel struct {
	ModelType    string             `json:"model_type"`
	ModelPath    string             `json:"model_path"`
	Features     []string           `json:"features"`
	Weights      map[string]float64 `json:"weights"`
	Biases       map[string]float64 `json:"biases"`
	Accuracy     float64            `json:"accuracy"`
	Precision    float64            `json:"precision"`
	Recall       float64            `json:"recall"`
	F1Score      float64            `json:"f1_score"`
	LastTrained  time.Time          `json:"last_trained"`
	IsLoaded     bool               `json:"is_loaded"`
}

// AnalysisResult contains comprehensive analysis results
type AnalysisResult struct {
	RequestID         string                 `json:"request_id"`
	Timestamp         time.Time              `json:"timestamp"`
	ThreatScore       float64                `json:"threat_score"`
	RiskLevel         string                 `json:"risk_level"`
	Confidence        float64                `json:"confidence"`
	ThreatTypes       []string               `json:"threat_types"`
	AnalysisDetails   AnalysisDetails        `json:"analysis_details"`
	Recommendations   []string               `json:"recommendations"`
	ProcessingTime    time.Duration          `json:"processing_time"`
	Metadata          map[string]interface{} `json:"metadata"`
}

// AnalysisDetails contains detailed analysis information
type AnalysisDetails struct {
	BehavioralAnalysis  BehavioralAnalysisResult  `json:"behavioral_analysis"`
	StatisticalAnalysis StatisticalAnalysisResult `json:"statistical_analysis"`
	SignatureMatches    []SignatureMatchResult    `json:"signature_matches"`
	AnomalyDetection    AnomalyDetectionResult    `json:"anomaly_detection"`
	ReputationAnalysis  ReputationAnalysisResult  `json:"reputation_analysis"`
	MLPrediction        MLPredictionResult        `json:"ml_prediction"`
	GeographicAnalysis  GeographicAnalysisResult  `json:"geographic_analysis"`
}

// BehavioralAnalysisResult contains behavioral analysis results
type BehavioralAnalysisResult struct {
	Score           float64            `json:"score"`
	Patterns        []string           `json:"patterns"`
	Anomalies       []string           `json:"anomalies"`
	SessionAnalysis SessionAnalysisResult `json:"session_analysis"`
	UserProfile     UserProfileResult  `json:"user_profile"`
}

// SessionAnalysisResult contains session analysis results
type SessionAnalysisResult struct {
	IsNewSession      bool    `json:"is_new_session"`
	SessionDuration   float64 `json:"session_duration"`
	RequestFrequency  float64 `json:"request_frequency"`
	NavigationPattern string  `json:"navigation_pattern"`
	BehaviorScore     float64 `json:"behavior_score"`
}

// UserProfileResult contains user profiling results
type UserProfileResult struct {
	IsKnownUser       bool    `json:"is_known_user"`
	ProfileMatch      float64 `json:"profile_match"`
	DeviationScore    float64 `json:"deviation_score"`
	TrustScore        float64 `json:"trust_score"`
}

// StatisticalAnalysisResult contains statistical analysis results
type StatisticalAnalysisResult struct {
	Score              float64            `json:"score"`
	ZScores            map[string]float64 `json:"z_scores"`
	OutlierProbability float64            `json:"outlier_probability"`
	BaselineDeviation  float64            `json:"baseline_deviation"`
	DistributionFit    string             `json:"distribution_fit"`
}

// SignatureMatchResult contains signature matching results
type SignatureMatchResult struct {
	SignatureID   string  `json:"signature_id"`
	SignatureName string  `json:"signature_name"`
	Matched       bool    `json:"matched"`
	Confidence    float64 `json:"confidence"`
	Severity      string  `json:"severity"`
	Category      string  `json:"category"`
	MatchedText   string  `json:"matched_text"`
	Position      int     `json:"position"`
}

// AnomalyDetectionResult contains anomaly detection results
type AnomalyDetectionResult struct {
	IsAnomalous     bool               `json:"is_anomalous"`
	AnomalyScore    float64            `json:"anomaly_score"`
	AnomalyTypes    []string           `json:"anomaly_types"`
	AnomalyDetails  map[string]float64 `json:"anomaly_details"`
	Explanations    []string           `json:"explanations"`
}

// ReputationAnalysisResult contains reputation analysis results
type ReputationAnalysisResult struct {
	Score           float64  `json:"score"`
	ReputationLevel string   `json:"reputation_level"`
	ThreatSources   []string `json:"threat_sources"`
	GeographicRisk  float64  `json:"geographic_risk"`
	ASNRisk         float64  `json:"asn_risk"`
}

// MLPredictionResult contains ML prediction results
type MLPredictionResult struct {
	Prediction      float64            `json:"prediction"`
	Confidence      float64            `json:"confidence"`
	FeatureScores   map[string]float64 `json:"feature_scores"`
	ModelVersion    string             `json:"model_version"`
	PredictionClass string             `json:"prediction_class"`
}

// GeographicAnalysisResult contains geographic analysis results
type GeographicAnalysisResult struct {
	Country         string  `json:"country"`
	Region          string  `json:"region"`
	City            string  `json:"city"`
	RiskScore       float64 `json:"risk_score"`
	IsHighRiskRegion bool   `json:"is_high_risk_region"`
	DistanceFromNormal float64 `json:"distance_from_normal"`
	VPNProbability  float64 `json:"vpn_probability"`
	TorProbability  float64 `json:"tor_probability"`
}

// NewThreatAnalyzer creates a new threat analyzer instance
func NewThreatAnalyzer(logger *logrus.Logger) *ThreatAnalyzer {
	analyzer := &ThreatAnalyzer{
		logger:          logger,
		ipReputationDB:  make(map[string]IPReputationInfo),
		signatureDB:     make(map[string]ThreatSignature),
		behaviorProfiles: make(map[string]BehaviorProfile),
		statisticalModel: StatisticalModel{
			Baselines:     make(map[string]Baseline),
			Distributions: make(map[string]Distribution),
			Correlations:  make(map[string]float64),
			Thresholds:    make(map[string]float64),
		},
		mlModel: MachineLearningModel{
			Features: []string{
				"request_size", "response_time", "error_rate", "request_frequency",
				"unique_endpoints", "geographic_distance", "user_agent_entropy",
				"header_count", "parameter_count", "payload_entropy",
			},
			Weights: make(map[string]float64),
			Biases:  make(map[string]float64),
		},
	}

	// Initialize default threat signatures
	analyzer.initializeDefaultSignatures()

	// Initialize statistical baselines
	analyzer.initializeStatisticalBaselines()

	// Load ML model weights
	analyzer.initializeMLModel()

	return analyzer
}

// AnalyzeThreat performs comprehensive threat analysis
func (ta *ThreatAnalyzer) AnalyzeThreat(ctx context.Context, request *ThreatAnalysisRequest) (*AnalysisResult, error) {
	startTime := time.Now()

	ta.mutex.RLock()
	defer ta.mutex.RUnlock()

	result := &AnalysisResult{
		RequestID:  generateAnalysisID(),
		Timestamp:  time.Now(),
		Metadata:   make(map[string]interface{}),
	}

	// Perform behavioral analysis
	behavioralResult := ta.performBehavioralAnalysis(request)
	result.AnalysisDetails.BehavioralAnalysis = behavioralResult

	// Perform statistical analysis
	statisticalResult := ta.performStatisticalAnalysis(request)
	result.AnalysisDetails.StatisticalAnalysis = statisticalResult

	// Perform signature matching
	signatureResults := ta.performSignatureMatching(request)
	result.AnalysisDetails.SignatureMatches = signatureResults

	// Perform anomaly detection
	anomalyResult := ta.performAnomalyDetection(request)
	result.AnalysisDetails.AnomalyDetection = anomalyResult

	// Perform reputation analysis
	reputationResult := ta.performReputationAnalysis(request)
	result.AnalysisDetails.ReputationAnalysis = reputationResult

	// Perform ML prediction
	mlResult := ta.performMLPrediction(request)
	result.AnalysisDetails.MLPrediction = mlResult

	// Perform geographic analysis
	geoResult := ta.performGeographicAnalysis(request)
	result.AnalysisDetails.GeographicAnalysis = geoResult

	// Calculate overall threat score
	result.ThreatScore = ta.calculateOverallThreatScore(&result.AnalysisDetails)

	// Determine risk level
	result.RiskLevel = ta.determineRiskLevel(result.ThreatScore)

	// Calculate confidence
	result.Confidence = ta.calculateConfidence(&result.AnalysisDetails)

	// Identify threat types
	result.ThreatTypes = ta.identifyThreatTypes(&result.AnalysisDetails)

	// Generate recommendations
	result.Recommendations = ta.generateRecommendations(&result.AnalysisDetails, result.ThreatScore)

	result.ProcessingTime = time.Since(startTime)

	return result, nil
}

// performBehavioralAnalysis analyzes behavioral patterns
func (ta *ThreatAnalyzer) performBehavioralAnalysis(request *ThreatAnalysisRequest) BehavioralAnalysisResult {
	result := BehavioralAnalysisResult{
		Patterns:  make([]string, 0),
		Anomalies: make([]string, 0),
	}

	// Analyze user agent patterns
	userAgentScore := ta.analyzeUserAgent(request.UserAgent)
	result.Score += userAgentScore * 0.2

	if userAgentScore > 0.7 {
		result.Patterns = append(result.Patterns, "suspicious_user_agent")
	}

	// Analyze request patterns
	requestScore := ta.analyzeRequestPatterns(request)
	result.Score += requestScore * 0.3

	// Analyze session behavior
	sessionResult := ta.analyzeSessionBehavior(request)
	result.SessionAnalysis = sessionResult
	result.Score += sessionResult.BehaviorScore * 0.3

	// Analyze user profile
	userResult := ta.analyzeUserProfile(request)
	result.UserProfile = userResult
	result.Score += (1.0 - userResult.TrustScore) * 0.2

	// Normalize score
	if result.Score > 1.0 {
		result.Score = 1.0
	}

	return result
}

// performStatisticalAnalysis performs statistical analysis
func (ta *ThreatAnalyzer) performStatisticalAnalysis(request *ThreatAnalysisRequest) StatisticalAnalysisResult {
	result := StatisticalAnalysisResult{
		ZScores: make(map[string]float64),
	}

	// Calculate z-scores for various metrics
	if baseline, exists := ta.statisticalModel.Baselines["request_size"]; exists {
		zScore := (float64(request.RequestSize) - baseline.Mean) / baseline.StdDev
		result.ZScores["request_size"] = zScore
		
		if math.Abs(zScore) > 3.0 {
			result.Score += 0.3
		}
	}

	if baseline, exists := ta.statisticalModel.Baselines["response_time"]; exists {
		zScore := (request.ResponseTime - baseline.Mean) / baseline.StdDev
		result.ZScores["response_time"] = zScore
		
		if math.Abs(zScore) > 2.5 {
			result.Score += 0.2
		}
	}

	// Calculate outlier probability
	result.OutlierProbability = ta.calculateOutlierProbability(request)

	// Calculate baseline deviation
	result.BaselineDeviation = ta.calculateBaselineDeviation(request)

	result.Score = math.Min(result.Score, 1.0)

	return result
}

// performSignatureMatching performs signature-based detection
func (ta *ThreatAnalyzer) performSignatureMatching(request *ThreatAnalysisRequest) []SignatureMatchResult {
	results := make([]SignatureMatchResult, 0)

	// Check request path against signatures
	for _, signature := range ta.signatureDB {
		if !signature.Enabled {
			continue
		}

		match := SignatureMatchResult{
			SignatureID:   signature.ID,
			SignatureName: signature.Name,
			Severity:      signature.Severity,
			Category:      signature.Category,
		}

		// Check if pattern matches
		if signature.Regex != nil {
			if matches := signature.Regex.FindStringSubmatch(request.RequestPath); len(matches) > 0 {
				match.Matched = true
				match.MatchedText = matches[0]
				match.Confidence = 1.0 - signature.FalsePositiveRate
				match.Position = strings.Index(request.RequestPath, matches[0])
			}
		}

		// Check user agent
		if signature.Category == "user_agent" && signature.Regex != nil {
			if matches := signature.Regex.FindStringSubmatch(request.UserAgent); len(matches) > 0 {
				match.Matched = true
				match.MatchedText = matches[0]
				match.Confidence = 1.0 - signature.FalsePositiveRate
			}
		}

		// Check headers
		if signature.Category == "headers" {
			for headerName, headerValue := range request.Headers {
				headerString := fmt.Sprintf("%s: %s", headerName, headerValue)
				if signature.Regex != nil && signature.Regex.MatchString(headerString) {
					match.Matched = true
					match.MatchedText = headerString
					match.Confidence = 1.0 - signature.FalsePositiveRate
					break
				}
			}
		}

		if match.Matched {
			results = append(results, match)
		}
	}

	return results
}

// performAnomalyDetection performs anomaly detection
func (ta *ThreatAnalyzer) performAnomalyDetection(request *ThreatAnalysisRequest) AnomalyDetectionResult {
	result := AnomalyDetectionResult{
		AnomalyTypes:   make([]string, 0),
		AnomalyDetails: make(map[string]float64),
		Explanations:   make([]string, 0),
	}

	// Check for size anomalies
	if request.RequestSize > 10*1024*1024 { // 10MB
		result.AnomalyTypes = append(result.AnomalyTypes, "large_request")
		result.AnomalyDetails["request_size"] = float64(request.RequestSize)
		result.AnomalyScore += 0.4
	}

	// Check for timing anomalies
	if request.ResponseTime > 10.0 { // 10 seconds
		result.AnomalyTypes = append(result.AnomalyTypes, "slow_response")
		result.AnomalyDetails["response_time"] = request.ResponseTime
		result.AnomalyScore += 0.3
	}

	// Check for geographic anomalies
	if ta.isGeographicAnomaly(request) {
		result.AnomalyTypes = append(result.AnomalyTypes, "geographic_anomaly")
		result.AnomalyScore += 0.3
	}

	result.IsAnomalous = result.AnomalyScore > 0.5
	result.AnomalyScore = math.Min(result.AnomalyScore, 1.0)

	return result
}

// Helper functions for analysis
func (ta *ThreatAnalyzer) analyzeUserAgent(userAgent string) float64 {
	score := 0.0

	// Check for bot patterns
	botPatterns := []string{"bot", "crawler", "spider", "scraper"}
	for _, pattern := range botPatterns {
		if strings.Contains(strings.ToLower(userAgent), pattern) {
			score += 0.5
			break
		}
	}

	// Check for suspicious patterns
	if len(userAgent) < 10 || len(userAgent) > 500 {
		score += 0.3
	}

	// Check entropy (randomness)
	entropy := calculateEntropy(userAgent)
	if entropy > 4.0 {
		score += 0.2
	}

	return math.Min(score, 1.0)
}

// calculateEntropy calculates Shannon entropy of a string
func calculateEntropy(s string) float64 {
	if len(s) == 0 {
		return 0.0
	}

	// Count character frequencies
	frequencies := make(map[rune]int)
	for _, r := range s {
		frequencies[r]++
	}

	// Calculate entropy
	entropy := 0.0
	length := float64(len(s))
	
	for _, count := range frequencies {
		if count > 0 {
			freq := float64(count) / length
			entropy -= freq * math.Log2(freq)
		}
	}

	return entropy
}

// initializeDefaultSignatures initializes default threat signatures
func (ta *ThreatAnalyzer) initializeDefaultSignatures() {
	signatures := []ThreatSignature{
		{
			ID:          "sql_injection_1",
			Name:        "SQL Injection Pattern",
			Pattern:     `(?i)(union\s+select|or\s+1\s*=\s*1|drop\s+table)`,
			Category:    "injection",
			Severity:    "high",
			Description: "Detects common SQL injection patterns",
			Enabled:     true,
			FalsePositiveRate: 0.05,
		},
		{
			ID:          "xss_1",
			Name:        "Cross-Site Scripting",
			Pattern:     `(?i)(<script|javascript:|on\w+\s*=)`,
			Category:    "injection",
			Severity:    "medium",
			Description: "Detects XSS attack patterns",
			Enabled:     true,
			FalsePositiveRate: 0.1,
		},
		{
			ID:          "path_traversal_1",
			Name:        "Path Traversal Attack",
			Pattern:     `(\.\.\/|\.\.\\|%2e%2e%2f|%2e%2e%5c)`,
			Category:    "traversal",
			Severity:    "high",
			Description: "Detects directory traversal attempts",
			Enabled:     true,
			FalsePositiveRate: 0.02,
		},
	}

	for _, sig := range signatures {
		if regex, err := regexp.Compile(sig.Pattern); err == nil {
			sig.Regex = regex
			sig.CreatedAt = time.Now()
			sig.UpdatedAt = time.Now()
			ta.signatureDB[sig.ID] = sig
		}
	}
}

// Additional helper functions and analysis methods...
func generateAnalysisID() string {
	hash := sha256.Sum256([]byte(fmt.Sprintf("%d", time.Now().UnixNano())))
	return hex.EncodeToString(hash[:])[:16]
}

func (ta *ThreatAnalyzer) isGeographicAnomaly(request *ThreatAnalysisRequest) bool {
	// Simplified geographic anomaly detection
	highRiskCountries := []string{"CN", "RU", "KP", "IR"}
	for _, country := range highRiskCountries {
		if request.GeoLocation.Country == country {
			return true
		}
	}
	return false
}

func (ta *ThreatAnalyzer) calculateOverallThreatScore(details *AnalysisDetails) float64 {
	score := 0.0
	
	// Weight different analysis components
	score += details.BehavioralAnalysis.Score * 0.25
	score += details.StatisticalAnalysis.Score * 0.20
	score += details.ReputationAnalysis.Score * 0.20
	score += details.AnomalyDetection.AnomalyScore * 0.15
	score += details.MLPrediction.Prediction * 0.20
	
	return math.Min(score, 1.0)
}

func (ta *ThreatAnalyzer) determineRiskLevel(score float64) string {
	if score >= 0.8 {
		return "critical"
	} else if score >= 0.6 {
		return "high"
	} else if score >= 0.4 {
		return "medium"
	} else if score >= 0.2 {
		return "low"
	}
	return "minimal"
}
