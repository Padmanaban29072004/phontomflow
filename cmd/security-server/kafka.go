package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"time"

	"github.com/segmentio/kafka-go"
	"github.com/sirupsen/logrus"
)

// KafkaClient manages Kafka producer and consumer connections.
type KafkaClient struct {
	brokers   []string
	consumer  *kafka.Reader
	producer  *kafka.Writer
	logger    *logrus.Logger
	ctx       context.Context
	cancel    context.CancelFunc
}

// NewKafkaClient creates a new Kafka client.
func NewKafkaClient(brokers []string, groupID string, logger *logrus.Logger) *KafkaClient {
	ctx, cancel := context.WithCancel(context.Background())

	consumer := kafka.NewReader(kafka.ReaderConfig{
		Brokers:     brokers,
		GroupID:     groupID,
		Topic:       "threat-detected",
		MinBytes:    10,
		MaxBytes:    10e6,
		MaxWait:     1 * time.Second,
		StartOffset: kafka.LastOffset,
	})

	producer := &kafka.Writer{
		Addr:     kafka.TCP(brokers...),
		Balancer: &kafka.LeastBytes{},
		BatchTimeout: 10 * time.Millisecond,
	}

	return &KafkaClient{
		brokers:  brokers,
		consumer: consumer,
		producer: producer,
		logger:   logger,
		ctx:      ctx,
		cancel:   cancel,
	}
}

// StartConsumer begins consuming events from the threat-detected topic.
func (k *KafkaClient) StartConsumer(engine *ThreatEngine) {
	go func() {
		k.logger.Info("Kafka consumer started: threat-detected")

		for {
			select {
			case <-k.ctx.Done():
				k.logger.Info("Kafka consumer stopped")
				return
			default:
				msg, err := k.consumer.ReadMessage(k.ctx)
				if err != nil {
					if k.ctx.Err() != nil {
						return
					}
					k.logger.WithError(err).Warn("Kafka read error")
					time.Sleep(1 * time.Second)
					continue
				}

				var event map[string]interface{}
				if err := json.Unmarshal(msg.Value, &event); err != nil {
					k.logger.WithError(err).Warn("Failed to parse Kafka message")
					continue
				}

				k.logger.WithFields(logrus.Fields{
					"topic": msg.Topic,
					"ip":    event["clientIp"],
					"score": event["threatScore"],
				}).Debug("Received threat-detected event")

				// Trigger threat engine analysis
				if engine != nil {
					request := &ThreatAnalysisRequest{
						IPAddress:   fmt.Sprintf("%v", event["clientIp"]),
						RequestPath: fmt.Sprintf("%v", event["requestPath"]),
						Method:      fmt.Sprintf("%v", event["requestMethod"]),
						Timestamp:   time.Now(),
					}

					ctx, cancel := context.WithTimeout(k.ctx, 10*time.Second)
					_, err := engine.AnalyzeThreat(ctx, request)
					cancel()

					if err != nil {
						k.logger.WithError(err).Warn("Threat analysis triggered by Kafka failed")
					}
				}
			}
		}
	}()
}

// PublishEvent sends an event to a Kafka topic.
func (k *KafkaClient) PublishEvent(topic string, event interface{}) error {
	data, err := json.Marshal(event)
	if err != nil {
		return fmt.Errorf("failed to marshal event: %w", err)
	}

	msg := kafka.Message{
		Topic: topic,
		Value: data,
		Time:  time.Now(),
	}

	ctx, cancel := context.WithTimeout(k.ctx, 5*time.Second)
	defer cancel()

	return k.producer.WriteMessages(ctx, msg)
}

// PublishHoneypotTriggered publishes a honeypot-triggered event.
func (k *KafkaClient) PublishHoneypotTriggered(ip, endpoint string) {
	event := map[string]interface{}{
		"eventId":         fmt.Sprintf("hp_%d", time.Now().UnixNano()),
		"clientIp":        ip,
		"endpoint":        endpoint,
		"sourceService":   "phantom-flow-go-server",
		"timestampUnixMs": time.Now().UnixMilli(),
	}

	if err := k.PublishEvent("honeypot-triggered", event); err != nil {
		k.logger.WithError(err).Warn("Failed to publish honeypot-triggered event")
	} else {
		k.logger.WithFields(logrus.Fields{
			"ip":       ip,
			"endpoint": endpoint,
		}).Info("Published honeypot-triggered event")
	}
}

// Close shuts down the Kafka client.
func (k *KafkaClient) Close() error {
	k.cancel()
	if err := k.consumer.Close(); err != nil {
		log.Printf("Failed to close Kafka consumer: %v", err)
	}
	if err := k.producer.Close(); err != nil {
		log.Printf("Failed to close Kafka producer: %v", err)
	}
	return nil
}
