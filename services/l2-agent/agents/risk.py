from typing import Any, Dict


def score_incident(context_payload: Dict[str, Any], timeline_payload: Dict[str, Any]) -> Dict[str, Any]:
    events = context_payload.get("events", [])
    affected_hosts = len({e.get("host") for e in events if e.get("host")})
    criticality = max((e.get("asset", {}).get("criticality_score", 1) for e in events), default=1)
    has_exfil = len(timeline_payload.get("kill_chain", {}).get("exfiltration", [])) > 0
    has_lateral = len(timeline_payload.get("kill_chain", {}).get("lateral_movement", [])) > 0

    score = 0.2
    score += min(0.2, len(events) * 0.03)
    score += min(0.3, affected_hosts * 0.05)
    score += min(0.3, (criticality / 10))
    if has_exfil:
        score += 0.2
    if has_lateral:
        score += 0.15

    severity = "low"
    if score >= 0.8:
        severity = "critical"
    elif score >= 0.65:
        severity = "high"
    elif score >= 0.45:
        severity = "medium"

    return {
        "severity_score": round(min(score, 1.0), 3),
        "severity": severity,
        "blast_radius_hosts": affected_hosts,
        "max_asset_criticality": criticality,
    }

