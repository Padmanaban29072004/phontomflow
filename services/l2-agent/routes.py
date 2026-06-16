from typing import Any, Dict

from fastapi import APIRouter
from pydantic import BaseModel

from graph import run_investigation_graph
from connectors.thehive import push_case_to_thehive

router = APIRouter()


class InvestigateRequest(BaseModel):
    entity: Dict[str, str]
    mongo_events: list[Dict[str, Any]] = []
    influx_events: list[Dict[str, Any]] = []
    push_to_thehive: bool = False


@router.post("/investigate")
def investigate(payload: InvestigateRequest):
    state = run_investigation_graph(payload.entity, payload.mongo_events, payload.influx_events)
    report = state.get("report", {})
    thehive_result = None
    if payload.push_to_thehive and report:
        thehive_result = push_case_to_thehive(report)
    return {"state": state, "report": report, "thehive": thehive_result}

