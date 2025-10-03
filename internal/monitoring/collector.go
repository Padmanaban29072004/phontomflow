// PHANTOM-Flow System Monitoring Collector
package monitoring

import (
	"context"
	"encoding/json"
	"fmt"
	"runtime"
	"sync"
	"time"
)

type Collector struct {
	metrics    map[string]Metric
	mu         sync.RWMutex
	interval   time.Duration
	ctx        context.Context
	cancel     context.CancelFunc
	subscribers []Subscriber
}

type Metric struct {
	Name      string                 `json:"name"`
	Value     interface{}            `json:"value"`
	Type      MetricType             `json:"type"`
	Timestamp time.Time              `json:"timestamp"`
	Labels    map[string]string      `json:"labels"`
	Metadata  map[string]interface{} `json:"metadata"`
}

type MetricType int

const (
	Counter MetricType = iota
	Gauge
	Histogram
	Timer
)

type Subscriber interface {
	OnMetric(metric Metric)
}

type SystemMetrics struct {
	CPUUsage    float64 `json:"cpu_usage"`
	MemoryUsage uint64  `json:"memory_usage"`
	Goroutines  int     `json:"goroutines"`
	HeapSize    uint64  `json:"heap_size"`
	GCs         uint32  `json:"gcs"`
}

type NetworkMetrics struct {
	Connections    int     `json:"connections"`
	BytesIn        uint64  `json:"bytes_in"`
	BytesOut       uint64  `json:"bytes_out"`
	PacketsIn      uint64  `json:"packets_in"`
	PacketsOut     uint64  `json:"packets_out"`
	Latency        float64 `json:"latency"`
	ErrorRate      float64 `json:"error_rate"`
}

type SecurityMetrics struct {
	ThreatsDetected    int     `json:"threats_detected"`
	RequestsBlocked    int     `json:"requests_blocked"`
	FalsePositives     int     `json:"false_positives"`
	DetectionAccuracy  float64 `json:"detection_accuracy"`
	ResponseTime       float64 `json:"response_time"`
	Throughput         float64 `json:"throughput"`
}

func NewCollector(interval time.Duration) *Collector {
	ctx, cancel := context.WithCancel(context.Background())
	return &Collector{
		metrics:     make(map[string]Metric),
		interval:    interval,
		ctx:         ctx,
		cancel:      cancel,
		subscribers: make([]Subscriber, 0),
	}
}

func (c *Collector) Start() {
	go c.collectionLoop()
}

func (c *Collector) Stop() {
	c.cancel()
}

func (c *Collector) collectionLoop() {
	ticker := time.NewTicker(c.interval)
	defer ticker.Stop()

	for {
		select {
		case <-c.ctx.Done():
			return
		case <-ticker.C:
			c.collectSystemMetrics()
			c.collectNetworkMetrics()
			c.collectSecurityMetrics()
		}
	}
}

func (c *Collector) collectSystemMetrics() {
	var m runtime.MemStats
	runtime.ReadMemStats(&m)

	systemMetrics := SystemMetrics{
		CPUUsage:    c.getCPUUsage(),
		MemoryUsage: m.Alloc,
		Goroutines:  runtime.NumGoroutine(),
		HeapSize:    m.HeapSys,
		GCs:         m.NumGC,
	}

	c.recordMetric("system.cpu_usage", systemMetrics.CPUUsage, Gauge)
	c.recordMetric("system.memory_usage", systemMetrics.MemoryUsage, Gauge)
	c.recordMetric("system.goroutines", systemMetrics.Goroutines, Gauge)
	c.recordMetric("system.heap_size", systemMetrics.HeapSize, Gauge)
	c.recordMetric("system.gcs", systemMetrics.GCs, Counter)
}

func (c *Collector) collectNetworkMetrics() {
	// Simulated network metrics collection
	networkMetrics := NetworkMetrics{
		Connections: 150,
		BytesIn:     1024000,
		BytesOut:    2048000,
		PacketsIn:   5000,
		PacketsOut:  4500,
		Latency:     25.5,
		ErrorRate:   0.02,
	}

	c.recordMetric("network.connections", networkMetrics.Connections, Gauge)
	c.recordMetric("network.bytes_in", networkMetrics.BytesIn, Counter)
	c.recordMetric("network.bytes_out", networkMetrics.BytesOut, Counter)
	c.recordMetric("network.latency", networkMetrics.Latency, Gauge)
	c.recordMetric("network.error_rate", networkMetrics.ErrorRate, Gauge)
}

func (c *Collector) collectSecurityMetrics() {
	// Simulated security metrics collection
	securityMetrics := SecurityMetrics{
		ThreatsDetected:   25,
		RequestsBlocked:   150,
		FalsePositives:    3,
		DetectionAccuracy: 0.95,
		ResponseTime:      12.3,
		Throughput:        1250.5,
	}

	c.recordMetric("security.threats_detected", securityMetrics.ThreatsDetected, Counter)
	c.recordMetric("security.requests_blocked", securityMetrics.RequestsBlocked, Counter)
	c.recordMetric("security.false_positives", securityMetrics.FalsePositives, Counter)
	c.recordMetric("security.detection_accuracy", securityMetrics.DetectionAccuracy, Gauge)
	c.recordMetric("security.response_time", securityMetrics.ResponseTime, Timer)
	c.recordMetric("security.throughput", securityMetrics.Throughput, Gauge)
}

func (c *Collector) recordMetric(name string, value interface{}, metricType MetricType) {
	metric := Metric{
		Name:      name,
		Value:     value,
		Type:      metricType,
		Timestamp: time.Now(),
		Labels:    make(map[string]string),
		Metadata:  make(map[string]interface{}),
	}

	c.mu.Lock()
	c.metrics[name] = metric
	c.mu.Unlock()

	// Notify subscribers
	for _, subscriber := range c.subscribers {
		subscriber.OnMetric(metric)
	}
}

func (c *Collector) getCPUUsage() float64 {
	// Simplified CPU usage calculation
	return 45.2
}

func (c *Collector) GetMetric(name string) (Metric, bool) {
	c.mu.RLock()
	defer c.mu.RUnlock()
	metric, exists := c.metrics[name]
	return metric, exists
}

func (c *Collector) GetAllMetrics() map[string]Metric {
	c.mu.RLock()
	defer c.mu.RUnlock()
	
	metrics := make(map[string]Metric)
	for k, v := range c.metrics {
		metrics[k] = v
	}
	return metrics
}

func (c *Collector) Subscribe(subscriber Subscriber) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.subscribers = append(c.subscribers, subscriber)
}

func (c *Collector) GetMetricsJSON() ([]byte, error) {
	c.mu.RLock()
	defer c.mu.RUnlock()
	return json.Marshal(c.metrics)
}

func (c *Collector) GetSystemHealth() SystemHealth {
	c.mu.RLock()
	defer c.mu.RUnlock()

	health := SystemHealth{
		Status:    "healthy",
		Timestamp: time.Now(),
		Checks:    make(map[string]CheckResult),
	}

	// Check CPU usage
	if cpuMetric, exists := c.metrics["system.cpu_usage"]; exists {
		if cpu, ok := cpuMetric.Value.(float64); ok {
			if cpu > 90 {
				health.Checks["cpu"] = CheckResult{Status: "critical", Message: "High CPU usage"}
				health.Status = "critical"
			} else if cpu > 70 {
				health.Checks["cpu"] = CheckResult{Status: "warning", Message: "Elevated CPU usage"}
				if health.Status == "healthy" {
					health.Status = "warning"
				}
			} else {
				health.Checks["cpu"] = CheckResult{Status: "ok", Message: "CPU usage normal"}
			}
		}
	}

	// Check memory usage
	if memMetric, exists := c.metrics["system.memory_usage"]; exists {
		if mem, ok := memMetric.Value.(uint64); ok {
			if mem > 1000000000 { // 1GB
				health.Checks["memory"] = CheckResult{Status: "warning", Message: "High memory usage"}
				if health.Status == "healthy" {
					health.Status = "warning"
				}
			} else {
				health.Checks["memory"] = CheckResult{Status: "ok", Message: "Memory usage normal"}
			}
		}
	}

	return health
}

type SystemHealth struct {
	Status    string                 `json:"status"`
	Timestamp time.Time              `json:"timestamp"`
	Checks    map[string]CheckResult `json:"checks"`
}

type CheckResult struct {
	Status  string `json:"status"`
	Message string `json:"message"`
}

type LogSubscriber struct {
	ID string
}

func (ls *LogSubscriber) OnMetric(metric Metric) {
	fmt.Printf("[%s] Metric: %s = %v (Type: %d)\n", 
		ls.ID, metric.Name, metric.Value, metric.Type)
}
