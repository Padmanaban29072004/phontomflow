import os
from typing import Any, Dict

import requests


def push_case_to_thehive(report: Dict[str, Any]) -> Dict[str, Any]:
    base_url = os.getenv("THEHIVE_URL")
    api_key = os.getenv("THEHIVE_API_KEY")
    if not base_url or not api_key:
      return {"ok": True, "mode": "simulated", "detail": "TheHive not configured"}

    payload = {
        "title": "PHANTOM-Flow L2 Investigation",
        "description": report.get("executive_summary", ""),
        "severity": 3 if report.get("risk", {}).get("severity") in {"high", "critical"} else 2,
        "tags": report.get("ttp_list", []),
        "customFields": {
            "iocs": {"string": ",".join(report.get("ttp_list", []))}
        },
    }
    resp = requests.post(
        f"{base_url.rstrip('/')}/api/case",
        json=payload,
        headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
        timeout=20,
    )
    resp.raise_for_status()
    return {"ok": True, "mode": "live", "case": resp.json()}

