from typing import Any, Dict, List


MITRE_HINTS = {
    "powershell": "T1059.001",
    "mimikatz": "T1003.001",
    "rundll32": "T1218.011",
    "encodedcommand": "T1027",
    "wmic": "T1047",
    "psexec": "T1569.002",
    "credential": "T1110",
}


def map_ttps(context_payload: Dict[str, Any]) -> Dict[str, Any]:
    events: List[Dict[str, Any]] = context_payload.get("events", [])
    joined = " ".join(str(e).lower() for e in events)
    ttps = sorted({ttp for needle, ttp in MITRE_HINTS.items() if needle in joined})
    return {
        "ttps": ttps,
        "confidence": min(1.0, 0.4 + 0.1 * len(ttps)),
        "method": "heuristic+stix-ready",
    }

