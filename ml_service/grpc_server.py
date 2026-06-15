import asyncio
import logging
import os
import sys
from typing import Optional

import grpc
from grpc import aio as grpc_aio

sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'generated'))

from ml_models.threat_detection_model import AdvancedThreatDetectionModel
import ml_service_pb2
import ml_service_pb2_grpc

logger = logging.getLogger("ml-service.grpc")


class MLInferenceServicer(ml_service_pb2_grpc.MLInferenceServicer):
    def __init__(self, model: Optional[AdvancedThreatDetectionModel] = None):
        self._model = model

    async def Predict(
        self,
        request: ml_service_pb2.PredictRequest,
        context: grpc_aio.ServicerContext,
    ) -> ml_service_pb2.PredictResponse:
        model = self._model
        if model is None or not model.is_trained:
            return ml_service_pb2.PredictResponse(
                success=False,
                threat_score=0.0,
                anomaly_score=0.0,
                confidence=0.0,
                error="Model not initialized or not trained",
            )

        try:
            features = list(request.features)
            if not features and request.ip_address:
                features = [hash(request.ip_address) % 1000 / 1000.0]

            threat_score = 0.0
            anomaly_score = 0.0

            if features:
                import numpy as np
                import pandas as pd
                X = pd.DataFrame([features])
                result = model.predict(X)
                if 'neural_network' in result:
                    probs = result['neural_network']['probabilities']
                    threat_score = float(probs[0]) if probs else 0.0
                elif 'random_forest' in result:
                    probs = result['random_forest']['probabilities']
                    threat_score = float(probs[0]) if probs else 0.0

                anomaly_score = max(0.0, min(1.0, threat_score * 0.8))

            return ml_service_pb2.PredictResponse(
                success=True,
                threat_score=max(0.0, min(1.0, threat_score)),
                anomaly_score=anomaly_score,
                confidence=0.85,
                error="",
            )
        except Exception as e:
            logger.exception("gRPC Predict failed")
            return ml_service_pb2.PredictResponse(
                success=False,
                threat_score=0.0,
                anomaly_score=0.0,
                confidence=0.0,
                error=str(e),
            )


async def serve_grpc(
    model: Optional[AdvancedThreatDetectionModel] = None,
    host: str = "0.0.0.0",
    port: int = 8001,
) -> grpc_aio.Server:
    server = grpc_aio.server()
    servicer = MLInferenceServicer(model)
    ml_service_pb2_grpc.add_MLInferenceServicer_to_server(servicer, server)
    server.add_insecure_port(f"{host}:{port}")
    await server.start()
    logger.info(f"gRPC server listening on {host}:{port}")
    return server
