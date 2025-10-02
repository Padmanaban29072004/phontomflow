// PHANTOM-Flow Alert Management System
package alerts

import (
	"context"
	"fmt"
	"sync"
	"time"
)

type Manager struct {
	alerts    map[string]*Alert
	rules     []Rule
	channels  []Channel
	mu        sync.RWMutex
	ctx       context.Context
	cancel    context.CancelFunc
}

type Alert struct {
	ID          string
	Title       string
	Description string
	Severity    Severity
	Status      Status
	CreatedAt   time.Time
	UpdatedAt   time.Time
	Tags        []string
	Metadata    map[string]interface{}
}

type Severity int

const (
	Low Severity = iota
	Medium
	High
	Critical
)

type Status int

const (
	New Status = iota
	Acknowledged
	Resolved
	Suppressed
)

type Rule struct {
	ID          string
	Name        string
	Condition   string
	Severity    Severity
	Enabled     bool
	Actions     []Action
}

type Action struct {
	Type   ActionType
	Config map[string]interface{}
}

type ActionType int

const (
	EmailAction ActionType = iota
	SlackAction
	WebhookAction
	SMSAction
)

type Channel interface {
	Send(alert *Alert) error
	GetType() ActionType
}

func NewManager() *Manager {
	ctx, cancel := context.WithCancel(context.Background())
	return &Manager{
		alerts:   make(map[string]*Alert),
		rules:    make([]Rule, 0),
		channels: make([]Channel, 0),
		ctx:      ctx,
		cancel:   cancel,
	}
}

func (m *Manager) AddAlert(alert *Alert) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	
	alert.CreatedAt = time.Now()
	alert.UpdatedAt = time.Now()
	alert.Status = New
	
	m.alerts[alert.ID] = alert
	
	go m.processAlert(alert)
	return nil
}

func (m *Manager) processAlert(alert *Alert) {
	for _, rule := range m.rules {
		if m.matchesRule(alert, rule) {
			for _, action := range rule.Actions {
				m.executeAction(alert, action)
			}
		}
	}
}

func (m *Manager) matchesRule(alert *Alert, rule Rule) bool {
	if !rule.Enabled {
		return false
	}
	return alert.Severity >= rule.Severity
}

func (m *Manager) executeAction(alert *Alert, action Action) {
	for _, channel := range m.channels {
		if channel.GetType() == action.Type {
			if err := channel.Send(alert); err != nil {
				fmt.Printf("Failed to send alert via %v: %v\n", action.Type, err)
			}
		}
	}
}

func (m *Manager) GetAlert(id string) *Alert {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return m.alerts[id]
}

func (m *Manager) UpdateAlert(id string, status Status) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	
	if alert, exists := m.alerts[id]; exists {
		alert.Status = status
		alert.UpdatedAt = time.Now()
		return nil
	}
	return fmt.Errorf("alert not found: %s", id)
}

func (m *Manager) AddRule(rule Rule) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.rules = append(m.rules, rule)
}

func (m *Manager) AddChannel(channel Channel) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.channels = append(m.channels, channel)
}

func (m *Manager) GetAlerts() []*Alert {
	m.mu.RLock()
	defer m.mu.RUnlock()
	
	alerts := make([]*Alert, 0, len(m.alerts))
	for _, alert := range m.alerts {
		alerts = append(alerts, alert)
	}
	return alerts
}

func (m *Manager) Start() error {
	go m.cleanupWorker()
	return nil
}

func (m *Manager) Stop() error {
	m.cancel()
	return nil
}

func (m *Manager) cleanupWorker() {
	ticker := time.NewTicker(1 * time.Hour)
	defer ticker.Stop()
	
	for {
		select {
		case <-m.ctx.Done():
			return
		case <-ticker.C:
			m.cleanupOldAlerts()
		}
	}
}

func (m *Manager) cleanupOldAlerts() {
	m.mu.Lock()
	defer m.mu.Unlock()
	
	cutoff := time.Now().Add(-24 * time.Hour)
	for id, alert := range m.alerts {
		if alert.Status == Resolved && alert.UpdatedAt.Before(cutoff) {
			delete(m.alerts, id)
		}
	}
}
