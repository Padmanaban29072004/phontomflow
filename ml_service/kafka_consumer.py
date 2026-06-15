import asyncio
import json
import logging
from typing import Optional, Callable, Awaitable

from aiokafka import AIOKafkaConsumer

from ml_models.threat_detection_model import AdvancedThreatDetectionModel

logger = logging.getLogger("ml-service.kafka")

ThreatHandler = Callable[[dict], Awaitable[None]]


async def consume_threats(
    model: Optional[AdvancedThreatDetectionModel] = None,
    brokers: str = "localhost:9092",
    group_id: str = "phantom-flow-ml",
    on_threat: Optional[ThreatHandler] = None,
    stop_event: Optional[asyncio.Event] = None,
):
    if stop_event is None:
        stop_event = asyncio.Event()

    consumer = AIOKafkaConsumer(
        "threat-detected",
        bootstrap_servers=brokers,
        group_id=group_id,
        value_deserializer=lambda m: json.loads(m.decode("utf-8")),
        auto_offset_reset="latest",
        enable_auto_commit=True,
    )

    try:
        await consumer.start()
        logger.info("Kafka consumer started, subscribing to threat-detected")

        while not stop_event.is_set():
            try:
                result = await asyncio.wait_for(
                    consumer.getone(), timeout=1.0
                )
                event = result.value
                logger.debug(
                    f"Received threat-detected: "
                    f"ip={event.get('clientIp', 'unknown')} "
                    f"score={event.get('threatScore', 0)}"
                )

                if on_threat:
                    await on_threat(event)

                if model is not None and model.is_trained:
                    features = [event.get("threatScore", 0.5)]
                    ip = event.get("clientIp", "")
                    if ip:
                        features.append(hash(ip) % 1000 / 1000.0)

                    import pandas as pd
                    X = pd.DataFrame([features])
                    result = model.predict(X)
                    logger.info(
                        f"ML inference triggered by event: "
                        f"threat_score={event.get('threatScore')}, "
                        f"model_prediction={'malicious' if result else 'benign'}"
                    )

            except asyncio.TimeoutError:
                continue
            except Exception as e:
                logger.warning(f"Kafka consumer error: {e}")
                await asyncio.sleep(1)

    except Exception as e:
        logger.error(f"Kafka consumer failed: {e}")
    finally:
        await consumer.stop()
        logger.info("Kafka consumer stopped")
