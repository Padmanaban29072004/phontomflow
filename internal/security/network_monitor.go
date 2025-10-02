// PHANTOM-Flow Network Security Monitor
// Real-time network traffic analysis and threat detection

package security

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"log"
	"net"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/google/gopacket"
	"github.com/google/gopacket/layers"
	"github.com/google/gopacket/pcap"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/sirupsen/logrus"
	"golang.org/x/time/rate"
)

// NetworkMonitor provides real-time network security monitoring
type NetworkMonitor struct {
	config          *MonitorConfig
	logger          *logrus.Logger
	packetProcessor *PacketProcessor
	threatDetector  *ThreatDetector
	alertManager    *AlertManager
	metrics         *MonitorMetrics
	rateLimiters    map[string]*rate.Limiter
	rateLimiterMux  sync.RWMutex
	ctx             context.Context
	cancel          context.CancelFunc
	wg              sync.WaitGroup
}

// MonitorConfig contains configuration for the network monitor
type MonitorConfig struct {
	Interface           string        `json:"interface"`
	SnapshotLength      int32         `json:"snapshot_length"`
	Promiscuous         bool          `json:"promiscuous"`
	Timeout             time.Duration `json:"timeout"`
	BufferSize          int           `json:"buffer_size"`
	WorkerCount         int           `json:"worker_count"`
	AlertThresholds     map[string]float64 `json:"alert_thresholds"`
	RateLimitRPS        int           `json:"rate_limit_rps"`
	RateLimitBurst      int           `json:"rate_limit_burst"`
	GeoIPDatabase       string        `json:"geoip_database"`
	ThreatIntelFeeds    []string      `json:"threat_intel_feeds"`
	EnableDPI           bool          `json:"enable_dpi"`
	EnableMLDetection   bool          `json:"enable_ml_detection"`
	LogLevel            string        `json:"log_level"`
	MetricsEnabled      bool          `json:"metrics_enabled"`
	ExportPCAP          bool          `json:"export_pcap"`
	PCAPRotationSize    int64         `json:"pcap_rotation_size"`
}

// PacketProcessor handles packet capture and initial processing
type PacketProcessor struct {
	handle      *pcap.Handle
	packetChan  chan gopacket.Packet
	workerCount int
	logger      *logrus.Logger
	metrics     *PacketMetrics
}

// ThreatDetector performs threat analysis on network traffic
type ThreatDetector struct {
	signatures      []ThreatSignature
	behaviorEngine  *BehaviorAnalysisEngine
	mlEngine        *MLThreatEngine
	geoIPService    *GeoIPService
	threatIntel     *ThreatIntelligenceService
	logger          *logrus.Logger
	metrics         *ThreatMetrics
	mutex           sync.RWMutex
}

// AlertManager handles threat alerts and notifications
type AlertManager struct {
	config      *AlertConfig
	logger      *logrus.Logger
	alertChan   chan ThreatAlert
	webhooks    []WebhookConfig
	emailConfig *EmailConfig
	slackConfig *SlackConfig
	metrics     *AlertMetrics
}

// MonitorMetrics contains Prometheus metrics for monitoring
type MonitorMetrics struct {
	PacketsProcessed    prometheus.Counter
	ThreatsDetected     prometheus.Counter
	AlertsGenerated     prometheus.Counter
	ProcessingLatency   prometheus.Histogram
	ThreatsByType       *prometheus.CounterVec
	ThreatsBySeverity   *prometheus.CounterVec
	NetworkBandwidth    prometheus.Gauge
	ConnectionsActive   prometheus.Gauge
	PacketDropRate      prometheus.Gauge
}

// PacketMetrics contains packet processing metrics
type PacketMetrics struct {
	TotalPackets     uint64
	DroppedPackets   uint64
	ErrorPackets     uint64
	ProcessingTime   time.Duration
	LastProcessed    time.Time
	PacketSizes      []int
	ProtocolCounts   map[string]uint64
	mutex            sync.RWMutex
}

// ThreatMetrics contains threat detection metrics
type ThreatMetrics struct {
	ThreatsDetected     uint64
	FalsePositives      uint64
	TruePositives       uint64
	DetectionAccuracy   float64
	ResponseTime        time.Duration
	ThreatTypes         map[string]uint64
	SeverityDistribution map[string]uint64
	mutex               sync.RWMutex
}

// AlertMetrics contains alert management metrics
type AlertMetrics struct {
	AlertsGenerated     uint64
	AlertsAcknowledged  uint64
	AlertsResolved      uint64
	NotificationsSent   uint64
	NotificationsFailed uint64
	ResponseTime        time.Duration
	mutex               sync.RWMutex
}

// ThreatSignature represents a network threat signature
type ThreatSignature struct {
	ID              string            `json:"id"`
	Name            string            `json:"name"`
	Description     string            `json:"description"`
	Category        string            `json:"category"`
	Severity        string            `json:"severity"`
	Protocol        string            `json:"protocol"`
	SourcePorts     []int             `json:"source_ports"`
	DestPorts       []int             `json:"dest_ports"`
	PayloadPattern  string            `json:"payload_pattern"`
	HeaderPatterns  map[string]string `json:"header_patterns"`
	Flags           []string          `json:"flags"`
	PacketSize      *SizeRange        `json:"packet_size"`
	Frequency       *FrequencyPattern `json:"frequency"`
	GeoRestrictions []string          `json:"geo_restrictions"`
	Enabled         bool              `json:"enabled"`
	CreatedAt       time.Time         `json:"created_at"`
	UpdatedAt       time.Time         `json:"updated_at"`
	Confidence      float64           `json:"confidence"`
	References      []string          `json:"references"`
	CVEID           string            `json:"cve_id"`
}

// SizeRange represents a packet size range
type SizeRange struct {
	Min int `json:"min"`
	Max int `json:"max"`
}

// FrequencyPattern represents packet frequency patterns
type FrequencyPattern struct {
	PacketsPerSecond int           `json:"packets_per_second"`
	TimeWindow       time.Duration `json:"time_window"`
	BurstSize        int           `json:"burst_size"`
}

// BehaviorAnalysisEngine analyzes network behavior patterns
type BehaviorAnalysisEngine struct {
	connectionTracker *ConnectionTracker
	flowAnalyzer      *FlowAnalyzer
	anomalyDetector   *AnomalyDetector
	baselineManager   *BaselineManager
	logger            *logrus.Logger
	metrics           *BehaviorMetrics
}

// ConnectionTracker tracks network connections
type ConnectionTracker struct {
	connections map[string]*Connection
	mutex       sync.RWMutex
	maxAge      time.Duration
	cleanupTick *time.Ticker
}

// Connection represents a network connection
type Connection struct {
	ID              string            `json:"id"`
	SourceIP        net.IP            `json:"source_ip"`
	DestIP          net.IP            `json:"dest_ip"`
	SourcePort      int               `json:"source_port"`
	DestPort        int               `json:"dest_port"`
	Protocol        string            `json:"protocol"`
	StartTime       time.Time         `json:"start_time"`
	LastSeen        time.Time         `json:"last_seen"`
	BytesSent       uint64            `json:"bytes_sent"`
	BytesReceived   uint64            `json:"bytes_received"`
	PacketsSent     uint64            `json:"packets_sent"`
	PacketsReceived uint64            `json:"packets_received"`
	State           string            `json:"state"`
	Flags           []string          `json:"flags"`
	ApplicationData map[string]interface{} `json:"application_data"`
	ThreatScore     float64           `json:"threat_score"`
	GeoInfo         *GeoLocation      `json:"geo_info"`
}

// FlowAnalyzer analyzes network flows
type FlowAnalyzer struct {
	flows        map[string]*NetworkFlow
	flowTimeout  time.Duration
	mutex        sync.RWMutex
	aggregator   *FlowAggregator
	classifier   *TrafficClassifier
}

// NetworkFlow represents a network flow
type NetworkFlow struct {
	FlowID        string            `json:"flow_id"`
	SourceIP      net.IP            `json:"source_ip"`
	DestIP        net.IP            `json:"dest_ip"`
	SourcePort    int               `json:"source_port"`
	DestPort      int               `json:"dest_port"`
	Protocol      string            `json:"protocol"`
	StartTime     time.Time         `json:"start_time"`
	EndTime       time.Time         `json:"end_time"`
	Duration      time.Duration     `json:"duration"`
	TotalBytes    uint64            `json:"total_bytes"`
	TotalPackets  uint64            `json:"total_packets"`
	AvgPacketSize float64           `json:"avg_packet_size"`
	PacketSizes   []int             `json:"packet_sizes"`
	InterArrival  []time.Duration   `json:"inter_arrival"`
	TCPFlags      map[string]int    `json:"tcp_flags"`
	PayloadData   []byte            `json:"payload_data"`
	Classification string           `json:"classification"`
	Anomalies     []string          `json:"anomalies"`
	ThreatScore   float64           `json:"threat_score"`
	Metadata      map[string]interface{} `json:"metadata"`
}

// AnomalyDetector detects network anomalies
type AnomalyDetector struct {
	algorithms      []AnomalyAlgorithm
	thresholds      map[string]float64
	historicalData  *HistoricalDataStore
	statisticsEngine *StatisticsEngine
	logger          *logrus.Logger
	metrics         *AnomalyMetrics
}

// AnomalyAlgorithm interface for anomaly detection algorithms
type AnomalyAlgorithm interface {
	Name() string
	Detect(data interface{}) (*AnomalyResult, error)
	UpdateModel(data interface{}) error
	GetThreshold() float64
	SetThreshold(threshold float64)
}

// AnomalyResult represents anomaly detection results
type AnomalyResult struct {
	Algorithm   string                 `json:"algorithm"`
	Score       float64                `json:"score"`
	Threshold   float64                `json:"threshold"`
	IsAnomaly   bool                   `json:"is_anomaly"`
	Confidence  float64                `json:"confidence"`
	Description string                 `json:"description"`
	Features    map[string]float64     `json:"features"`
	Context     map[string]interface{} `json:"context"`
	Timestamp   time.Time              `json:"timestamp"`
}

// BaselineManager manages network baselines
type BaselineManager struct {
	baselines    map[string]*NetworkBaseline
	updateTicker *time.Ticker
	mutex        sync.RWMutex
	storage      BaselineStorage
}

// NetworkBaseline represents network behavior baseline
type NetworkBaseline struct {
	ID                string                    `json:"id"`
	Name              string                    `json:"name"`
	TimeWindow        time.Duration             `json:"time_window"`
	TrafficVolume     *StatisticalDistribution  `json:"traffic_volume"`
	PacketSizes       *StatisticalDistribution  `json:"packet_sizes"`
	ConnectionCounts  *StatisticalDistribution  `json:"connection_counts"`
	ProtocolMix       map[string]float64        `json:"protocol_mix"`
	PortUsage         map[int]float64           `json:"port_usage"`
	GeographicPattern map[string]float64        `json:"geographic_pattern"`
	TimePatterns      map[int]float64           `json:"time_patterns"`
	CreatedAt         time.Time                 `json:"created_at"`
	UpdatedAt         time.Time                 `json:"updated_at"`
	SampleCount       uint64                    `json:"sample_count"`
	Confidence        float64                   `json:"confidence"`
}

// StatisticalDistribution represents statistical distribution parameters
type StatisticalDistribution struct {
	Mean       float64   `json:"mean"`
	Median     float64   `json:"median"`
	StdDev     float64   `json:"std_dev"`
	Min        float64   `json:"min"`
	Max        float64   `json:"max"`
	Percentiles map[int]float64 `json:"percentiles"`
	Skewness   float64   `json:"skewness"`
	Kurtosis   float64   `json:"kurtosis"`
}

// MLThreatEngine provides machine learning-based threat detection
type MLThreatEngine struct {
	models         map[string]MLModel
	featureEngine  *FeatureExtractor
	preprocessor   *DataPreprocessor
	predictor      *ThreatPredictor
	modelManager   *ModelManager
	logger         *logrus.Logger
	metrics        *MLMetrics
}

// MLModel interface for machine learning models
type MLModel interface {
	Name() string
	Version() string
	Predict(features []float64) (*PredictionResult, error)
	Train(data []TrainingExample) error
	Evaluate(testData []TrainingExample) (*EvaluationResult, error)
	Save(path string) error
	Load(path string) error
}

// PredictionResult represents ML prediction results
type PredictionResult struct {
	ModelName     string                 `json:"model_name"`
	Prediction    float64                `json:"prediction"`
	Confidence    float64                `json:"confidence"`
	ThreatType    string                 `json:"threat_type"`
	FeatureScores map[string]float64     `json:"feature_scores"`
	Metadata      map[string]interface{} `json:"metadata"`
	Timestamp     time.Time              `json:"timestamp"`
}

// TrainingExample represents training data
type TrainingExample struct {
	Features []float64              `json:"features"`
	Label    string                 `json:"label"`
	Weight   float64                `json:"weight"`
	Metadata map[string]interface{} `json:"metadata"`
}

// EvaluationResult represents model evaluation results
type EvaluationResult struct {
	Accuracy    float64            `json:"accuracy"`
	Precision   float64            `json:"precision"`
	Recall      float64            `json:"recall"`
	F1Score     float64            `json:"f1_score"`
	AUC         float64            `json:"auc"`
	ConfusionMatrix [][]int        `json:"confusion_matrix"`
	ClassMetrics map[string]ClassificationMetric `json:"class_metrics"`
}

// ClassificationMetric represents per-class metrics
type ClassificationMetric struct {
	Precision float64 `json:"precision"`
	Recall    float64 `json:"recall"`
	F1Score   float64 `json:"f1_score"`
	Support   int     `json:"support"`
}

// GeoIPService provides geographic IP information
type GeoIPService struct {
	database     GeoIPDatabase
	cache        *GeoIPCache
	updateTicker *time.Ticker
	logger       *logrus.Logger
}

// GeoLocation represents geographic location information
type GeoLocation struct {
	IP          string  `json:"ip"`
	Country     string  `json:"country"`
	CountryCode string  `json:"country_code"`
	Region      string  `json:"region"`
	City        string  `json:"city"`
	Latitude    float64 `json:"latitude"`
	Longitude   float64 `json:"longitude"`
	TimeZone    string  `json:"timezone"`
	ISP         string  `json:"isp"`
	Organization string `json:"organization"`
	ASN         int     `json:"asn"`
	ASNOrg      string  `json:"asn_org"`
	Threat      bool    `json:"threat"`
	Proxy       bool    `json:"proxy"`
	Tor         bool    `json:"tor"`
	Hosting     bool    `json:"hosting"`
}

// ThreatIntelligenceService provides threat intelligence data
type ThreatIntelligenceService struct {
	feeds       []ThreatFeed
	cache       *ThreatIntelCache
	updateTicker *time.Ticker
	logger      *logrus.Logger
	metrics     *ThreatIntelMetrics
}

// ThreatFeed represents a threat intelligence feed
type ThreatFeed struct {
	Name        string            `json:"name"`
	URL         string            `json:"url"`
	APIKey      string            `json:"api_key"`
	Format      string            `json:"format"`
	UpdateInterval time.Duration  `json:"update_interval"`
	Enabled     bool              `json:"enabled"`
	LastUpdate  time.Time         `json:"last_update"`
	RecordCount int               `json:"record_count"`
	Headers     map[string]string `json:"headers"`
	Timeout     time.Duration     `json:"timeout"`
}

// ThreatAlert represents a security threat alert
type ThreatAlert struct {
	ID            string                 `json:"id"`
	Timestamp     time.Time              `json:"timestamp"`
	ThreatType    string                 `json:"threat_type"`
	Severity      string                 `json:"severity"`
	Confidence    float64                `json:"confidence"`
	SourceIP      string                 `json:"source_ip"`
	DestIP        string                 `json:"dest_ip"`
	SourcePort    int                    `json:"source_port"`
	DestPort      int                    `json:"dest_port"`
	Protocol      string                 `json:"protocol"`
	Description   string                 `json:"description"`
	Evidence      []Evidence             `json:"evidence"`
	Signatures    []string               `json:"signatures"`
	GeoInfo       *GeoLocation           `json:"geo_info"`
	ThreatIntel   []ThreatIntelMatch     `json:"threat_intel"`
	Recommendations []string             `json:"recommendations"`
	Status        string                 `json:"status"`
	AssignedTo    string                 `json:"assigned_to"`
	Tags          []string               `json:"tags"`
	Metadata      map[string]interface{} `json:"metadata"`
	Hash          string                 `json:"hash"`
}

// Evidence represents evidence for a threat
type Evidence struct {
	Type        string                 `json:"type"`
	Description string                 `json:"description"`
	Data        interface{}            `json:"data"`
	Confidence  float64                `json:"confidence"`
	Source      string                 `json:"source"`
	Timestamp   time.Time              `json:"timestamp"`
	Metadata    map[string]interface{} `json:"metadata"`
}

// ThreatIntelMatch represents threat intelligence matches
type ThreatIntelMatch struct {
	Feed        string    `json:"feed"`
	IOC         string    `json:"ioc"`
	IOCType     string    `json:"ioc_type"`
	ThreatType  string    `json:"threat_type"`
	Confidence  float64   `json:"confidence"`
	FirstSeen   time.Time `json:"first_seen"`
	LastSeen    time.Time `json:"last_seen"`
	Description string    `json:"description"`
	References  []string  `json:"references"`
}

// AlertConfig contains alert configuration
type AlertConfig struct {
	EnableWebhooks     bool          `json:"enable_webhooks"`
	EnableEmail        bool          `json:"enable_email"`
	EnableSlack        bool          `json:"enable_slack"`
	EnableSyslog       bool          `json:"enable_syslog"`
	MinSeverity        string        `json:"min_severity"`
	MaxAlertsPerMinute int           `json:"max_alerts_per_minute"`
	DeduplicationWindow time.Duration `json:"deduplication_window"`
	EscalationRules    []EscalationRule `json:"escalation_rules"`
}

// EscalationRule defines alert escalation rules
type EscalationRule struct {
	Condition   string        `json:"condition"`
	Delay       time.Duration `json:"delay"`
	Action      string        `json:"action"`
	Recipients  []string      `json:"recipients"`
	MaxRetries  int           `json:"max_retries"`
}

// WebhookConfig contains webhook configuration
type WebhookConfig struct {
	Name    string            `json:"name"`
	URL     string            `json:"url"`
	Headers map[string]string `json:"headers"`
	Timeout time.Duration     `json:"timeout"`
	Retries int               `json:"retries"`
	Enabled bool              `json:"enabled"`
}

// EmailConfig contains email configuration
type EmailConfig struct {
	SMTPServer   string   `json:"smtp_server"`
	SMTPPort     int      `json:"smtp_port"`
	Username     string   `json:"username"`
	Password     string   `json:"password"`
	From         string   `json:"from"`
	Recipients   []string `json:"recipients"`
	TLS          bool     `json:"tls"`
	Enabled      bool     `json:"enabled"`
}

// SlackConfig contains Slack configuration
type SlackConfig struct {
	WebhookURL string `json:"webhook_url"`
	Channel    string `json:"channel"`
	Username   string `json:"username"`
	IconEmoji  string `json:"icon_emoji"`
	Enabled    bool   `json:"enabled"`
}

// NewNetworkMonitor creates a new network security monitor
func NewNetworkMonitor(config *MonitorConfig, logger *logrus.Logger) (*NetworkMonitor, error) {
	ctx, cancel := context.WithCancel(context.Background())
	
	// Initialize packet processor
	packetProcessor, err := NewPacketProcessor(config, logger)
	if err != nil {
		cancel()
		return nil, fmt.Errorf("failed to create packet processor: %w", err)
	}
	
	// Initialize threat detector
	threatDetector, err := NewThreatDetector(config, logger)
	if err != nil {
		cancel()
		return nil, fmt.Errorf("failed to create threat detector: %w", err)
	}
	
	// Initialize alert manager
	alertManager, err := NewAlertManager(config, logger)
	if err != nil {
		cancel()
		return nil, fmt.Errorf("failed to create alert manager: %w", err)
	}
	
	// Initialize metrics
	metrics := NewMonitorMetrics()
	
	monitor := &NetworkMonitor{
		config:          config,
		logger:          logger,
		packetProcessor: packetProcessor,
		threatDetector:  threatDetector,
		alertManager:    alertManager,
		metrics:         metrics,
		rateLimiters:    make(map[string]*rate.Limiter),
		ctx:             ctx,
		cancel:          cancel,
	}
	
	return monitor, nil
}

// Start begins network monitoring
func (nm *NetworkMonitor) Start() error {
	nm.logger.Info("Starting network security monitor")
	
	// Start packet processing
	if err := nm.packetProcessor.Start(nm.ctx); err != nil {
		return fmt.Errorf("failed to start packet processor: %w", err)
	}
	
	// Start threat detection
	if err := nm.threatDetector.Start(nm.ctx); err != nil {
		return fmt.Errorf("failed to start threat detector: %w", err)
	}
	
	// Start alert management
	if err := nm.alertManager.Start(nm.ctx); err != nil {
		return fmt.Errorf("failed to start alert manager: %w", err)
	}
	
	// Start monitoring workers
	nm.wg.Add(nm.config.WorkerCount)
	for i := 0; i < nm.config.WorkerCount; i++ {
		go nm.monitoringWorker(i)
	}
	
	// Start cleanup routine
	nm.wg.Add(1)
	go nm.cleanupRoutine()
	
	// Start metrics collection
	if nm.config.MetricsEnabled {
		nm.wg.Add(1)
		go nm.metricsCollector()
	}
	
	nm.logger.Info("Network security monitor started successfully")
	return nil
}

// Stop stops network monitoring
func (nm *NetworkMonitor) Stop() error {
	nm.logger.Info("Stopping network security monitor")
	
	// Cancel context to stop all goroutines
	nm.cancel()
	
	// Wait for all workers to finish
	nm.wg.Wait()
	
	// Stop components
	if err := nm.packetProcessor.Stop(); err != nil {
		nm.logger.WithError(err).Error("Error stopping packet processor")
	}
	
	if err := nm.threatDetector.Stop(); err != nil {
		nm.logger.WithError(err).Error("Error stopping threat detector")
	}
	
	if err := nm.alertManager.Stop(); err != nil {
		nm.logger.WithError(err).Error("Error stopping alert manager")
	}
	
	nm.logger.Info("Network security monitor stopped")
	return nil
}

// monitoringWorker processes network monitoring tasks
func (nm *NetworkMonitor) monitoringWorker(workerID int) {
	defer nm.wg.Done()
	
	workerLogger := nm.logger.WithField("worker_id", workerID)
	workerLogger.Info("Starting monitoring worker")
	
	for {
		select {
		case <-nm.ctx.Done():
			workerLogger.Info("Monitoring worker shutting down")
			return
		case packet := <-nm.packetProcessor.packetChan:
			startTime := time.Now()
			
			// Process packet for threats
			threats, err := nm.threatDetector.AnalyzePacket(packet)
			if err != nil {
				workerLogger.WithError(err).Error("Error analyzing packet")
				continue
			}
			
			// Generate alerts for detected threats
			for _, threat := range threats {
				alert := nm.createThreatAlert(threat, packet)
				
				select {
				case nm.alertManager.alertChan <- alert:
					nm.metrics.AlertsGenerated.Inc()
				case <-nm.ctx.Done():
					return
				default:
					workerLogger.Warn("Alert channel full, dropping alert")
				}
			}
			
			// Update metrics
			processingTime := time.Since(startTime)
			nm.metrics.ProcessingLatency.Observe(processingTime.Seconds())
			nm.metrics.PacketsProcessed.Inc()
			
			if len(threats) > 0 {
				nm.metrics.ThreatsDetected.Add(float64(len(threats)))
			}
		}
	}
}

// cleanupRoutine performs periodic cleanup tasks
func (nm *NetworkMonitor) cleanupRoutine() {
	defer nm.wg.Done()
	
	ticker := time.NewTicker(5 * time.Minute)
	defer ticker.Stop()
	
	for {
		select {
		case <-nm.ctx.Done():
			return
		case <-ticker.C:
			nm.performCleanup()
		}
	}
}

// metricsCollector collects and updates metrics
func (nm *NetworkMonitor) metricsCollector() {
	defer nm.wg.Done()
	
	ticker := time.NewTicker(30 * time.Second)
	defer ticker.Stop()
	
	for {
		select {
		case <-nm.ctx.Done():
			return
		case <-ticker.C:
			nm.updateMetrics()
		}
	}
}

// performCleanup performs periodic cleanup tasks
func (nm *NetworkMonitor) performCleanup() {
	// Cleanup rate limiters
	nm.rateLimiterMux.Lock()
	for ip, limiter := range nm.rateLimiters {
		// Remove unused rate limiters (simplified check)
		if limiter.Limit() == 0 {
			delete(nm.rateLimiters, ip)
		}
	}
	nm.rateLimiterMux.Unlock()
	
	// Cleanup threat detector resources
	nm.threatDetector.Cleanup()
	
	nm.logger.Debug("Cleanup completed")
}

// updateMetrics updates monitoring metrics
func (nm *NetworkMonitor) updateMetrics() {
	// Update packet processor metrics
	packetMetrics := nm.packetProcessor.GetMetrics()
	nm.metrics.NetworkBandwidth.Set(float64(packetMetrics.TotalPackets))
	nm.metrics.PacketDropRate.Set(float64(packetMetrics.DroppedPackets) / float64(packetMetrics.TotalPackets))
	
	// Update threat detector metrics
	threatMetrics := nm.threatDetector.GetMetrics()
	nm.metrics.ConnectionsActive.Set(float64(threatMetrics.ThreatsDetected))
}

// createThreatAlert creates a threat alert from detection results
func (nm *NetworkMonitor) createThreatAlert(threat *ThreatDetectionResult, packet gopacket.Packet) ThreatAlert {
	// Generate unique alert ID
	alertID := nm.generateAlertID(threat, packet)
	
	// Extract packet information
	sourceIP, destIP, sourcePort, destPort, protocol := nm.extractPacketInfo(packet)
	
	// Get geographic information
	var geoInfo *GeoLocation
	if nm.threatDetector.geoIPService != nil {
		geoInfo = nm.threatDetector.geoIPService.LookupIP(sourceIP)
	}
	
	// Get threat intelligence matches
	var threatIntel []ThreatIntelMatch
	if nm.threatDetector.threatIntel != nil {
		threatIntel = nm.threatDetector.threatIntel.LookupIP(sourceIP)
	}
	
	// Create evidence
	evidence := []Evidence{
		{
			Type:        "packet_analysis",
			Description: "Network packet triggered threat signature",
			Data:        threat.SignatureMatches,
			Confidence:  threat.Confidence,
			Source:      "packet_processor",
			Timestamp:   time.Now(),
		},
	}
	
	if threat.BehaviorAnalysis != nil {
		evidence = append(evidence, Evidence{
			Type:        "behavior_analysis",
			Description: "Behavioral anomaly detected",
			Data:        threat.BehaviorAnalysis,
			Confidence:  threat.BehaviorAnalysis.Confidence,
			Source:      "behavior_engine",
			Timestamp:   time.Now(),
		})
	}
	
	// Generate recommendations
	recommendations := nm.generateRecommendations(threat)
	
	alert := ThreatAlert{
		ID:              alertID,
		Timestamp:       time.Now(),
		ThreatType:      threat.ThreatType,
		Severity:        threat.Severity,
		Confidence:      threat.Confidence,
		SourceIP:        sourceIP,
		DestIP:          destIP,
		SourcePort:      sourcePort,
		DestPort:        destPort,
		Protocol:        protocol,
		Description:     threat.Description,
		Evidence:        evidence,
		Signatures:      threat.SignatureIDs,
		GeoInfo:         geoInfo,
		ThreatIntel:     threatIntel,
		Recommendations: recommendations,
		Status:          "new",
		Tags:            threat.Tags,
		Metadata:        threat.Metadata,
		Hash:            nm.calculateThreatHash(threat),
	}
	
	return alert
}

// generateAlertID generates a unique alert ID
func (nm *NetworkMonitor) generateAlertID(threat *ThreatDetectionResult, packet gopacket.Packet) string {
	data := fmt.Sprintf("%s-%s-%d", threat.ThreatType, threat.SourceIP, time.Now().UnixNano())
	hash := sha256.Sum256([]byte(data))
	return hex.EncodeToString(hash[:])[:16]
}

// extractPacketInfo extracts basic information from a packet
func (nm *NetworkMonitor) extractPacketInfo(packet gopacket.Packet) (string, string, int, int, string) {
	var sourceIP, destIP string
	var sourcePort, destPort int
	var protocol string
	
	// Extract IP layer
	if ipLayer := packet.Layer(layers.LayerTypeIPv4); ipLayer != nil {
		ip, _ := ipLayer.(*layers.IPv4)
		sourceIP = ip.SrcIP.String()
		destIP = ip.DstIP.String()
		protocol = ip.Protocol.String()
	} else if ipLayer := packet.Layer(layers.LayerTypeIPv6); ipLayer != nil {
		ip, _ := ipLayer.(*layers.IPv6)
		sourceIP = ip.SrcIP.String()
		destIP = ip.DstIP.String()
		protocol = ip.NextHeader.String()
	}
	
	// Extract transport layer
	if tcpLayer := packet.Layer(layers.LayerTypeTCP); tcpLayer != nil {
		tcp, _ := tcpLayer.(*layers.TCP)
		sourcePort = int(tcp.SrcPort)
		destPort = int(tcp.DstPort)
		protocol = "TCP"
	} else if udpLayer := packet.Layer(layers.LayerTypeUDP); udpLayer != nil {
		udp, _ := udpLayer.(*layers.UDP)
		sourcePort = int(udp.SrcPort)
		destPort = int(udp.DstPort)
		protocol = "UDP"
	}
	
	return sourceIP, destIP, sourcePort, destPort, protocol
}

// generateRecommendations generates security recommendations
func (nm *NetworkMonitor) generateRecommendations(threat *ThreatDetectionResult) []string {
	recommendations := []string{}
	
	switch threat.Severity {
	case "critical":
		recommendations = append(recommendations, "Immediately block source IP address")
		recommendations = append(recommendations, "Isolate affected systems")
		recommendations = append(recommendations, "Initiate incident response procedures")
	case "high":
		recommendations = append(recommendations, "Block source IP address")
		recommendations = append(recommendations, "Monitor for additional activity")
		recommendations = append(recommendations, "Review security policies")
	case "medium":
		recommendations = append(recommendations, "Monitor source IP address")
		recommendations = append(recommendations, "Increase logging verbosity")
		recommendations = append(recommendations, "Review traffic patterns")
	case "low":
		recommendations = append(recommendations, "Log for future analysis")
		recommendations = append(recommendations, "Monitor trends")
	}
	
	// Add threat-specific recommendations
	switch threat.ThreatType {
	case "ddos":
		recommendations = append(recommendations, "Implement rate limiting")
		recommendations = append(recommendations, "Enable DDoS protection")
	case "malware":
		recommendations = append(recommendations, "Scan affected systems")
		recommendations = append(recommendations, "Update antivirus signatures")
	case "intrusion":
		recommendations = append(recommendations, "Check for privilege escalation")
		recommendations = append(recommendations, "Review access logs")
	}
	
	return recommendations
}

// calculateThreatHash calculates a hash for threat deduplication
func (nm *NetworkMonitor) calculateThreatHash(threat *ThreatDetectionResult) string {
	data := fmt.Sprintf("%s-%s-%s-%s", 
		threat.ThreatType, 
		threat.SourceIP, 
		threat.DestIP, 
		strings.Join(threat.SignatureIDs, ","))
	
	hash := sha256.Sum256([]byte(data))
	return hex.EncodeToString(hash[:])
}

// GetRateLimiter gets or creates a rate limiter for an IP address
func (nm *NetworkMonitor) GetRateLimiter(ip string) *rate.Limiter {
	nm.rateLimiterMux.RLock()
	limiter, exists := nm.rateLimiters[ip]
	nm.rateLimiterMux.RUnlock()
	
	if exists {
		return limiter
	}
	
	nm.rateLimiterMux.Lock()
	defer nm.rateLimiterMux.Unlock()
	
	// Double-check after acquiring write lock
	if limiter, exists := nm.rateLimiters[ip]; exists {
		return limiter
	}
	
	// Create new rate limiter
	limiter = rate.NewLimiter(
		rate.Limit(nm.config.RateLimitRPS),
		nm.config.RateLimitBurst,
	)
	nm.rateLimiters[ip] = limiter
	
	return limiter
}

// GetStatistics returns monitoring statistics
func (nm *NetworkMonitor) GetStatistics() *MonitoringStatistics {
	packetMetrics := nm.packetProcessor.GetMetrics()
	threatMetrics := nm.threatDetector.GetMetrics()
	alertMetrics := nm.alertManager.GetMetrics()
	
	return &MonitoringStatistics{
		PacketsProcessed:    packetMetrics.TotalPackets,
		PacketsDropped:      packetMetrics.DroppedPackets,
		ThreatsDetected:     threatMetrics.ThreatsDetected,
		AlertsGenerated:     alertMetrics.AlertsGenerated,
		AlertsAcknowledged:  alertMetrics.AlertsAcknowledged,
		ProcessingLatency:   packetMetrics.ProcessingTime,
		DetectionAccuracy:   threatMetrics.DetectionAccuracy,
		Uptime:             time.Since(nm.startTime),
		LastUpdate:         time.Now(),
	}
}

// MonitoringStatistics represents monitoring statistics
type MonitoringStatistics struct {
	PacketsProcessed    uint64        `json:"packets_processed"`
	PacketsDropped      uint64        `json:"packets_dropped"`
	ThreatsDetected     uint64        `json:"threats_detected"`
	AlertsGenerated     uint64        `json:"alerts_generated"`
	AlertsAcknowledged  uint64        `json:"alerts_acknowledged"`
	ProcessingLatency   time.Duration `json:"processing_latency"`
	DetectionAccuracy   float64       `json:"detection_accuracy"`
	Uptime             time.Duration `json:"uptime"`
	LastUpdate         time.Time     `json:"last_update"`
}

// Additional implementation details would continue here...
// This provides a comprehensive network security monitoring system in Go
