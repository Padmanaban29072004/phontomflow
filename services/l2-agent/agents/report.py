from typing import Any, Dict


def build_report(
    context_payload: Dict[str, Any],
    ttp_payload: Dict[str, Any],
    timeline_payload: Dict[str, Any],
    risk_payload: Dict[str, Any],
) -> Dict[str, Any]:
    entity = context_payload.get("entity", {})
    return {
        "executive_summary": f"Incident around entity {entity} classified as {risk_payload.get('severity')}.",
        "affected_systems": sorted({e.get("host") for e in context_payload.get("events", []) if e.get("host")}),
        "ttp_list": ttp_payload.get("ttps", []),
        "root_cause": "Likely credential abuse followed by suspicious command execution.",
        "recommended_remediation_steps": [
            "Isolate affected endpoints",
            "Reset impacted credentials",
            "Block malicious indicators at edge/firewall",
            "Hunt for related IOCs in last 72h",
        ],
        "timeline": timeline_payload,
        "risk": risk_payload,
    }

