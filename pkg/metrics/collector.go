// PHANTOM-Flow Metrics Collection
package metrics

import (
	"sync"
	"time"
)

type Collector struct {
	mu sync.RWMutex
	metrics map[string]*Metric
	registry *Registry
}

type Metric struct {
	Name      string
	Type      MetricType
	Value     float64
	Labels    map[string]string
	Timestamp time.Time
}

type MetricType int

const (
	Counter MetricType = iota
	Gauge
	Histogram
	Timer
)

type Registry struct {
	collectors map[string]*Collector
	mu sync.RWMutex
}

func NewCollector(name string) *Collector {
	return &Collector{
		metrics: make(map[string]*Metric),
		registry: NewRegistry(),
	}
}

func NewRegistry() *Registry {
	return &Registry{
		collectors: make(map[string]*Collector),
	}
}

func (c *Collector) CounterInc(name string, labels map[string]string) {
	c.mu.Lock()
	defer c.mu.Unlock()
	
	key := c.buildKey(name, labels)
	if metric, exists := c.metrics[key]; exists {
		metric.Value++
		metric.Timestamp = time.Now()
	} else {
		c.metrics[key] = &Metric{
			Name: name,
			Type: Counter,
			Value: 1,
			Labels: labels,
			Timestamp: time.Now(),
		}
	}
}

func (c *Collector) GaugeSet(name string, value float64, labels map[string]string) {
	c.mu.Lock()
	defer c.mu.Unlock()
	
	key := c.buildKey(name, labels)
	c.metrics[key] = &Metric{
		Name: name,
		Type: Gauge,
		Value: value,
		Labels: labels,
		Timestamp: time.Now(),
	}
}

func (c *Collector) TimerRecord(name string, duration time.Duration, labels map[string]string) {
	c.mu.Lock()
	defer c.mu.Unlock()
	
	key := c.buildKey(name, labels)
	c.metrics[key] = &Metric{
		Name: name,
		Type: Timer,
		Value: duration.Seconds(),
		Labels: labels,
		Timestamp: time.Now(),
	}
}

func (c *Collector) buildKey(name string, labels map[string]string) string {
	key := name
	for k, v := range labels {
		key += ":" + k + "=" + v
	}
	return key
}

func (c *Collector) GetMetrics() []*Metric {
	c.mu.RLock()
	defer c.mu.RUnlock()
	
	metrics := make([]*Metric, 0, len(c.metrics))
	for _, metric := range c.metrics {
		metrics = append(metrics, metric)
	}
	return metrics
}

func (r *Registry) Register(name string, collector *Collector) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.collectors[name] = collector
}

func (r *Registry) GetCollector(name string) *Collector {
	r.mu.RLock()
	defer r.mu.RUnlock()
	return r.collectors[name]
}
