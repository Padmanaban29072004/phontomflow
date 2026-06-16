from typing import Any, Dict, List


def build_timeline(context_payload: Dict[str, Any]) -> Dict[str, Any]:
    events: List[Dict[str, Any]] = context_payload.get("events", [])
    sorted_events = sorted(events, key=lambda e: e.get("timestamp", ""))

    stages = {
        "initial_access": [],
        "execution": [],
        "persistence": [],
        "lateral_movement": [],
        "exfiltration": [],
    }

    for event in sorted_events:
        etype = str(event.get("event_type", "")).lower()
        text = str(event).lower()
        if "login" in etype or "auth" in etype:
            stages["initial_access"].append(event)
        if "exec" in etype or "powershell" in text or "cmd" in text:
            stages["execution"].append(event)
        if "registry" in text or "startup" in text or "scheduled task" in text:
            stages["persistence"].append(event)
        if "remote" in text or "psexec" in text or "lateral" in text:
            stages["lateral_movement"].append(event)
        if "exfil" in etype or "large_upload" in etype or "transfer" in text:
            stages["exfiltration"].append(event)

    return {
        "kill_chain": stages,
        "first_seen": sorted_events[0].get("timestamp") if sorted_events else None,
        "last_seen": sorted_events[-1].get("timestamp") if sorted_events else None,
    }

