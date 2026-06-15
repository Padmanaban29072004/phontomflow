import asyncio
import logging
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

import uvicorn

from ml_models.threat_detection_model import AdvancedThreatDetectionModel
from ai_models.advanced_threat_intelligence import AdvancedThreatIntelligenceSystem
from grpc_server import serve_grpc
from kafka_consumer import consume_threats

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("ml-service")

PORT = int(os.environ.get("PORT", "8000"))
GRPC_PORT = int(os.environ.get("GRPC_PORT", "8001"))
KAFKA_BROKERS = os.environ.get("KAFKA_BROKERS", "localhost:9092")
HOST = "0.0.0.0"


def main():
    logger.info("Initializing ML models...")
    ml_model = AdvancedThreatDetectionModel()
    threat_intel = AdvancedThreatIntelligenceSystem()
    logger.info("ML models initialized")

    stop_event = asyncio.Event()

    async def start():
        grpc_server = await serve_grpc(model=ml_model, host=HOST, port=GRPC_PORT)
        logger.info(f"gRPC server running on {HOST}:{GRPC_PORT}")

        kafka_task = asyncio.create_task(
            consume_threats(
                model=ml_model,
                brokers=KAFKA_BROKERS,
                group_id="phantom-flow-ml",
                stop_event=stop_event,
            )
        )

        config = uvicorn.Config(
            "main:app",
            host=HOST,
            port=PORT,
            log_level="info",
            loop="asyncio",
        )
        server = uvicorn.Server(config)

        logger.info(f"FastAPI server running on {HOST}:{PORT}")
        logger.info(f"Kafka brokers: {KAFKA_BROKERS}")

        try:
            await server.serve()
        finally:
            stop_event.set()
            kafka_task.cancel()
            try:
                await kafka_task
            except asyncio.CancelledError:
                pass
            await grpc_server.stop(5)
            logger.info("ML service shutdown complete")

    try:
        asyncio.run(start())
    except KeyboardInterrupt:
        logger.info("Shutdown requested")


if __name__ == "__main__":
    main()
