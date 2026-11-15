"""
api.py - local FastAPI surface for the AstroGuard Python health engine.

This service is intended to be reached through the Express boundary on
127.0.0.1. It contains no authentication of its own; Express owns Firebase /
signed-session authorization and must not expose this port publicly.

Run:
    python -m uvicorn python_engine.api:app --host 127.0.0.1 --port 8001
"""

from __future__ import annotations

from functools import lru_cache
from typing import Any

import pandas as pd
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

from .astronaut_health import (
    AstronautHealthMonitor,
    PARAMETER_DEFINITIONS,
    SIM_PROFILES,
    simulate_mission,
    validate_daily_log,
)

app = FastAPI(
    title="AstroGuard Health Engine",
    version="1.0.0",
    description=(
        "Prototype, simulated-data decision support. Not a diagnostic medical device. "
        "Do not expose this service directly to browsers."
    ),
)


@lru_cache(maxsize=1)
def get_monitor() -> AstronautHealthMonitor:
    return AstronautHealthMonitor.load_or_train()


class AnalyzeRequest(BaseModel):
    logs: list[dict[str, Any]] = Field(..., min_length=3, max_length=120)
    prior_career_msv: float = Field(default=0.0, ge=0.0, le=600.0)
    countermeasure_status: dict[str, bool] | None = None
    crew_id: str | None = Field(default=None, max_length=32)


class ValidateRequest(BaseModel):
    logs: list[dict[str, Any]] = Field(..., min_length=1, max_length=366)


class SimulateRequest(BaseModel):
    profile: str = "healthy"
    days: int = Field(default=30, ge=3, le=180)
    seed: int = Field(default=0, ge=0, le=2**31 - 1)
    countermeasure_status: dict[str, bool] | None = None


def _frame(logs: list[dict[str, Any]]) -> pd.DataFrame:
    try:
        frame = pd.DataFrame(logs)
    except Exception as exc:  # pragma: no cover - pandas error surface
        raise HTTPException(status_code=400, detail=f"invalid log payload: {exc}") from exc
    if frame.empty:
        raise HTTPException(status_code=400, detail="logs must not be empty")
    return frame


@app.get("/health")
def health() -> dict:
    return {
        "ok": True,
        "engine": "python",
        "status": "ready",
        "parameters": len(PARAMETER_DEFINITIONS),
        "is_simulated": True,
        "disclaimer": "Prototype decision support only; not a diagnostic medical device.",
    }


@app.get("/parameters")
def parameters() -> dict:
    return {
        "parameters": PARAMETER_DEFINITIONS,
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


@app.post("/validate")
def validate(request: ValidateRequest) -> dict:
    return validate_daily_log(_frame(request.logs))


@app.post("/analyze")
def analyze(request: AnalyzeRequest) -> dict:
    frame = _frame(request.logs)
    try:
        report = get_monitor().analyze(
            frame,
            prior_career_msv=request.prior_career_msv,
            countermeasure_status=request.countermeasure_status,
        )
    except (TypeError, ValueError) as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    report["engine"] = "python"
    report["is_simulated"] = True
    report["crew_id"] = request.crew_id
    return report


@app.post("/simulate")
def simulate(request: SimulateRequest) -> dict:
    if request.profile not in SIM_PROFILES:
        raise HTTPException(status_code=422, detail=f"profile must be one of {SIM_PROFILES}")
    frame = simulate_mission(request.profile, days=request.days, seed=request.seed)
    report = get_monitor().analyze(
        frame, countermeasure_status=request.countermeasure_status
    )
    report["engine"] = "python"
    report["is_simulated"] = True
    report["scenario"] = {"profile": request.profile, "days": request.days, "seed": request.seed}
    return {"logs": frame.to_dict(orient="records"), "report": report}
