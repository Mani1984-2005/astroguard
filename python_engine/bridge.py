"""
bridge.py - JSON-lines worker used by the Express backend.

Protocol (one JSON object per line):
    {"id": "...", "action": "analyze", "payload": {...}}
Response:
    {"id": "...", "ok": true, "result": {...}}
    {"id": "...", "ok": false, "error": "..."}

The worker keeps the trained models in memory so each API request does not pay
Python startup/model-loading cost. It performs no authentication; Express is
the only authorized boundary.
"""

from __future__ import annotations

import json
import os
import sys

import pandas as pd

# Allow both `python python_engine/bridge.py` and package execution.
HERE = os.path.dirname(os.path.abspath(__file__))
if HERE not in sys.path:
    sys.path.insert(0, HERE)

import astronaut_health as engine  # noqa: E402

_MONITOR = None


def _monitor():
    global _MONITOR
    if _MONITOR is None:
        _MONITOR = engine.AstronautHealthMonitor.load_or_train()
    return _MONITOR


def _frame(payload: dict) -> pd.DataFrame:
    logs = payload.get("logs")
    if not isinstance(logs, list) or not logs:
        raise ValueError("payload.logs must be a non-empty list of daily log objects")
    if len(logs) > 120:
        raise ValueError("payload.logs may contain at most 120 rows")
    return pd.DataFrame(logs)


def dispatch(action: str, payload: dict) -> dict:
    if action == "health":
        return {
            "ok": True,
            "engine": "python",
            "status": "ready",
            "parameters": len(engine.PARAMETER_DEFINITIONS),
            "is_simulated": True,
            "disclaimer": "Prototype decision support only; not a diagnostic medical device.",
        }
    if action == "parameters":
        return {
            "parameters": engine.PARAMETER_DEFINITIONS,
            "readiness": {
                "start": 100,
                "watch_penalty": 6,
                "alert_penalty": 15,
                "missing_data_cap": 70,
                "four_or_more_missing_cap": 40,
                "bands": {"FINE": ">=80", "CAUTION": "50-79", "DANGER": "<50"},
                "critical_alert_rule": "Any ALERT in a critical domain forces DANGER.",
            },
            "disclaimer": "Prototype rules and simulated model labels; not clinical validation.",
        }
    if action == "validate":
        return engine.validate_daily_log(_frame(payload))
    if action == "analyze":
        report = _monitor().analyze(
            _frame(payload),
            prior_career_msv=float(payload.get("priorCareerMsv", payload.get("prior_career_msv", 0.0)) or 0.0),
            countermeasure_status=payload.get("countermeasureStatus")
            or payload.get("countermeasure_status"),
        )
        report["engine"] = "python"
        report["is_simulated"] = True
        report["crew_id"] = payload.get("crewId") or payload.get("crew_id")
        return report
    if action == "simulate":
        profile = str(payload.get("profile", "healthy"))
        days = int(payload.get("days", 30))
        seed = int(payload.get("seed", 0))
        if profile not in engine.SIM_PROFILES:
            raise ValueError(f"profile must be one of {engine.SIM_PROFILES}")
        if not 3 <= days <= 180:
            raise ValueError("days must be between 3 and 180")
        frame = engine.simulate_mission(profile, days=days, seed=seed)
        report = _monitor().analyze(
            frame,
            countermeasure_status=payload.get("countermeasureStatus")
            or payload.get("countermeasure_status"),
        )
        report["engine"] = "python"
        report["is_simulated"] = True
        report["scenario"] = {"profile": profile, "days": days, "seed": seed}
        return {"logs": frame.to_dict(orient="records"), "report": report}
    raise ValueError(f"unknown action: {action!r}")


def main() -> None:
    if "--once" in sys.argv:
        raw = sys.stdin.read()
        try:
            request = json.loads(raw)
            result = dispatch(request.get("action", "health"), request.get("payload", {}))
            print(json.dumps({"id": request.get("id"), "ok": True, "result": result}))
        except Exception as exc:
            print(json.dumps({"id": None, "ok": False, "error": str(exc)}))
        return

    print(json.dumps({"ready": True, "engine": "python"}), flush=True)
    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        request_id = None
        try:
            request = json.loads(line)
            request_id = request.get("id")
            result = dispatch(request.get("action", "health"), request.get("payload", {}))
            print(json.dumps({"id": request_id, "ok": True, "result": result}), flush=True)
        except Exception as exc:
            print(json.dumps({"id": request_id, "ok": False, "error": str(exc)}), flush=True)


if __name__ == "__main__":
    main()
