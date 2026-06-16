import pathlib
import sys

L2_AGENT_PATH = pathlib.Path(__file__).resolve().parents[1] / "services" / "l2-agent"
sys.path.append(str(L2_AGENT_PATH))

from graph import run_investigation_graph


def test_l2_agent_identifies_kill_chain():
    events = [
        {"timestamp": "2026-06-16T00:00:00Z", "event_type": "login_failed", "host": "ws-1", "src_ip": "10.1.1.9"},
        {"timestamp": "2026-06-16T00:05:00Z", "event_type": "process_exec", "command": "powershell -enc AAA", "host": "ws-1"},
        {"timestamp": "2026-06-16T00:08:00Z", "event_type": "remote_exec", "command": "psexec \\\\db-1", "host": "db-1"},
        {"timestamp": "2026-06-16T00:20:00Z", "event_type": "large_upload", "bytes": 9999999, "host": "db-1"},
    ]

    result = run_investigation_graph(
        entity={"ip": "10.1.1.9", "user": "alice", "host": "ws-1"},
        mongo_events=events,
        influx_events=[],
    )

    assert result["report"]["risk"]["severity"] in {"medium", "high", "critical"}
    kc = result["report"]["timeline"]["kill_chain"]
    assert len(kc["execution"]) >= 1
    assert len(kc["lateral_movement"]) >= 1
    assert len(kc["exfiltration"]) >= 1

