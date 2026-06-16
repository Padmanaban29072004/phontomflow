from typing import Any, Dict

from agents.context import aggregate_context
from agents.ttp import map_ttps
from agents.timeline import build_timeline
from agents.risk import score_incident
from agents.report import build_report


def run_investigation_graph(
    entity: Dict[str, str],
    mongo_events: list[Dict[str, Any]],
    influx_events: list[Dict[str, Any]],
) -> Dict[str, Any]:
    state: Dict[str, Any] = {
        "entity": entity,
        "errors": [],
    }
    try:
        state["context"] = aggregate_context(entity, mongo_events, influx_events)
        state["ttp"] = map_ttps(state["context"])
        state["timeline"] = build_timeline(state["context"])
        state["risk"] = score_incident(state["context"], state["timeline"])
        state["report"] = build_report(state["context"], state["ttp"], state["timeline"], state["risk"])
    except Exception as exc:  # pragma: no cover
        state["errors"].append(str(exc))
    return state

