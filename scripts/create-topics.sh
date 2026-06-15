#!/bin/bash
set -euo pipefail

KAFKA_BROKERS="${KAFKA_BROKERS:-localhost:9092}"
TOPICS=(
  "threat-detected:3"
  "response-executed:3"
  "attack-observed:3"
  "model-updated:3"
  "honeypot-triggered:3"
)

echo "Waiting for Kafka at $KAFKA_BROKERS..."
cub kafka-ready -b "$KAFKA_BROKERS" 1 30

for topic_spec in "${TOPICS[@]}"; do
  topic="${topic_spec%%:*}"
  partitions="${topic_spec##*:}"
  echo "Creating topic: $topic (partitions: $partitions)"
  kafka-topics --bootstrap-server "$KAFKA_BROKERS" \
    --create --if-not-exists \
    --topic "$topic" \
    --partitions "$partitions" \
    --replication-factor 1
done

echo "All topics created successfully"
kafka-topics --bootstrap-server "$KAFKA_BROKERS" --list
