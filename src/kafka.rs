use std::sync::Arc;
use std::time::Duration;

use rdkafka::config::ClientConfig;
use rdkafka::consumer::{Consumer, StreamConsumer};
use rdkafka::message::Message;
use rdkafka::util::get_rdkafka_version;
use tokio::sync::Mutex;
use tracing::{error, info, warn};

use crate::security_engine::SecurityEngine;

pub async fn start_kafka_consumer(
    engine: Arc<Mutex<SecurityEngine>>,
    brokers: &str,
    group_id: &str,
    topics: &[&str],
    stop_signal: tokio::sync::watch::Receiver<bool>,
) -> Result<(), Box<dyn std::error::Error>> {
    let (version_n, version_s) = get_rdkafka_version();
    info!("rdkafka version: {} ({})", version_s, version_n);

    let consumer: StreamConsumer = ClientConfig::new()
        .set("group.id", group_id)
        .set("bootstrap.servers", brokers)
        .set("enable.partition.eof", "false")
        .set("session.timeout.ms", "6000")
        .set("enable.auto.commit", "true")
        .set("auto.offset.reset", "latest")
        .create()?;

    consumer.subscribe(topics)?;
    info!("Kafka consumer subscribed to topics: {:?}", topics);

    loop {
        if *stop_signal.borrow() {
            info!("Kafka consumer stopping");
            break;
        }

        match consumer.recv().await {
            Ok(msg) => {
                let topic = msg.topic();
                let payload = match msg.payload_view::<str>() {
                    Some(Ok(p)) => p,
                    _ => {
                        warn!("Kafka message with non-UTF-8 payload on {}", topic);
                        continue;
                    }
                };

                info!(
                    "Received Kafka event: topic={}, offset={}, payload_len={}",
                    topic,
                    msg.offset(),
                    payload.len()
                );

                if topic == "threat-detected" {
                    handle_threat_detected(&engine, payload).await;
                }
            }
            Err(e) => {
                error!("Kafka consumer error: {}", e);
                tokio::time::sleep(Duration::from_secs(1)).await;
            }
        }
    }

    Ok(())
}

async fn handle_threat_detected(
    engine: &Arc<Mutex<SecurityEngine>>,
    payload: &str,
) {
    let parsed: Result<serde_json::Value, _> = serde_json::from_str(payload);
    match parsed {
        Ok(event) => {
            let ip = event
                .get("clientIp")
                .and_then(|v| v.as_str())
                .unwrap_or("unknown");
            let score = event
                .get("threatScore")
                .and_then(|v| v.as_f64())
                .unwrap_or(0.0);
            info!("Processing threat-detected event: ip={}, score={}", ip, score);
        }
        Err(e) => {
            warn!("Failed to parse threat-detected event: {}", e);
        }
    }
}
