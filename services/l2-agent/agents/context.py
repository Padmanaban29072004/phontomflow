from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List


def aggregate_context(entity: Dict[str, str], mongo_events: List[Dict[str, Any]], influx_events: List[Dict[str, Any]]) -> Dict[str, Any]:
    now = datetime.now(timezone.utc)
    cutoff = now - timedelta(hours=72)

    def in_window(event: Dict[str, Any]) -> bool:
        ts = event.get("timestamp")
        if isinstance(ts, str):
            try:
                parsed = datetime.fromisoformat(ts.replace("Z", "+00:00"))
                return parsed >= cutoff
            except ValueError:
                return False
        return False

    related = []
    window_events = [e for e in (mongo_events + influx_events) if in_window(e)]
    keys = {entity.get("ip"), entity.get("user"), entity.get("host")}
    for event in window_events:
        blob = str(event).lower()
        if any(k and str(k).lower() in blob for k in keys) and in_window(event):
            related.append(event)

    # Expand to campaign context: once an incident is matched, include full window slice
    # so downstream agents can reconstruct sequence and impact.
    if related:
        related = window_events

    related.sort(key=lambda e: e.get("timestamp", ""))
    return {
        "entity": entity,
        "event_count": len(related),
        "events": related,
        "window_hours": 72,
    }

