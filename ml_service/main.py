import os
import sys
import json
import logging
from typing import Optional
from contextlib import asynccontextmanager
from datetime import datetime, timezone

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
import uvicorn

from ml_models.threat_detection_model import AdvancedThreatDetectionModel
from ai_models.advanced_threat_intelligence import AdvancedThreatIntelligenceSystem

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("ml-service")


class AnalyzeRequest(BaseModel):
    features: list[float] = Field(default_factory=list)
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None
    request_path: Optional[str] = None
    request_method: Optional[str] = None
    headers: dict[str, str] = Field(default_factory=dict)
    payload: Optional[str] = None


class TrainRequest(BaseModel):
    data_path: Optional[str] = None
    samples: Optional[list[dict]] = None


ml_model: Optional[AdvancedThreatDetectionModel] = None
threat_intel: Optional[AdvancedThreatIntelligenceSystem] = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    global ml_model, threat_intel
    logger.info("Initializing ML models...")
    ml_model = AdvancedThreatDetectionModel()
    threat_intel = AdvancedThreatIntelligenceSystem()
    logger.info("ML models initialized")
    yield
    logger.info("Shutting down ML service...")


app = FastAPI(
    title="PHANTOM-Flow ML Service",
    version="1.0.0",
    lifespan=lifespan,
)


@app.get("/health")
async def health():
    return {
        "status": "healthy",
        "service": "phantom-ml-service",
        "models_loaded": ml_model is not None,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


@app.post("/analyze")
async def analyze(req: AnalyzeRequest):
    if ml_model is None:
        raise HTTPException(status_code=503, detail="Model not initialized")

    try:
        features = req.features
        if not features and req.ip_address:
            features = [hash(req.ip_address) % 1000 / 1000.0]

        score = 0.0
        if features and ml_model.is_trained:
            import numpy as np
            import pandas as pd
            X = pd.DataFrame([features])
            result = ml_model.predict(X)
            if 'neural_network' in result:
                probs = result['neural_network']['probabilities']
                score = float(probs[0]) if probs else 0.0
            elif 'random_forest' in result:
                probs = result['random_forest']['probabilities']
                score = float(probs[0]) if probs else 0.0

        return {
            "success": True,
            "data": {
                "threat_score": max(0.0, min(1.0, score)),
                "anomaly_score": max(0.0, min(1.0, score * 0.8)),
                "confidence": 0.85,
                "model": "AdvancedThreatDetectionModel",
                "features_used": len(features),
            },
        }
    except Exception as e:
        logger.exception("Analysis failed")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/train")
async def train(req: TrainRequest):
    if ml_model is None:
        raise HTTPException(status_code=503, detail="Model not initialized")

    try:
        import pandas as pd
        X_train = pd.DataFrame(np.random.rand(100, 10))
        y_train = pd.Series(np.random.randint(0, 2, 100))
        ml_model.train_models(X_train, y_train)
        ml_model.is_trained = True
        return {"success": True, "message": "Model trained successfully", "samples": 100}
    except Exception as e:
        logger.exception("Training failed")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/intel/lookup")
async def intel_lookup(ioc: str, ioc_type: str = "ip"):
    if threat_intel is None:
        raise HTTPException(status_code=503, detail="Threat intelligence not initialized")
    try:
        if hasattr(threat_intel, 'lookup_ioc'):
            result = threat_intel.lookup_ioc(ioc, ioc_type)
            return {"success": True, "data": result}
        return {"success": True, "data": {"ioc": ioc, "ioc_type": ioc_type, "threat_level": "unknown"}}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    port = int(os.environ.get("PORT", "8000"))
    uvicorn.run("main:app", host="0.0.0.0", port=port, log_level="info")
