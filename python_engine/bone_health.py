"""
bone_health.py - transparent, deterministic bone-load model used by
``astronaut_health.py``.

IMPORTANT LIMITATION
--------------------
This is a prototype engineering model trained/calibrated on SIMULATED daily
exercise logs. It is not a validated model of human bone mineral density loss
and must never be presented as a clinical prediction or NASA flight rule.

The model is intentionally simple and inspectable:

* exercise minutes are combined into a weighted mechanical load;
* a 10-day exponential moving average represents the tissue's loading memory;
* unloading below the target load produces a bounded monthly loss rate;
* cumulative loss is the running sum of that rate.

The reason for replacing an opaque ML model with this rule set is
traceability: every number in the report can be explained from the input log.
"""

from __future__ import annotations

from dataclasses import dataclass, field
import json
import os
from typing import Iterable

import numpy as np
import pandas as pd

MISSION_DAYS = 180
HORIZON_DAYS = 30
TARGET_TOLERANCE = 0.85

# Loading profiles are dimensionless multipliers on the nominal exercise
# prescription. They are SIMULATED scenario inputs, not crew data.
PROFILES: tuple[dict, ...] = (
    {"name": "nominal", "resist": 45.0, "tread": 35.0, "cycle": 20.0},
    {"name": "low", "resist": 22.0, "tread": 18.0, "cycle": 10.0},
    {"name": "sedentary", "resist": 5.0, "tread": 5.0, "cycle": 2.0},
    {"name": "high", "resist": 60.0, "tread": 45.0, "cycle": 30.0},
)

WEIGHTS = {"resist_min": 0.70, "tread_min": 0.20, "cycle_min": 0.10}
TARGET_LOAD = 40.0
MAX_MONTHLY_LOSS_PCT = 1.5
LOAD_MEMORY_DAYS = 10
RISK_THRESHOLDS = (0.5, 1.5)  # next-30-day % loss: LOW <0.5, MEDIUM <1.5, HIGH
MODEL_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "bone_model.json")


def _profile_dict(profile) -> dict:
    if isinstance(profile, dict):
        return profile
    for item in PROFILES:
        if item.get("name") == profile:
            return item
    raise ValueError(f"unknown bone profile: {profile!r}")


def simulate_logs(profile="nominal", days: int = MISSION_DAYS, rng=None) -> pd.DataFrame:
    """Return a synthetic exercise log for one astronaut.

    The returned frame has the three exercise columns expected by both bone and
    muscle models. It is explicitly simulated data for demos and tests.
    """
    if days < 1:
        raise ValueError("days must be >= 1")
    rng = rng or np.random.default_rng(0)
    cfg = _profile_dict(profile)
    return pd.DataFrame(
        {
            "day": np.arange(1, days + 1),
            "resist_min": np.clip(rng.normal(cfg["resist"], 5.0, days), 0, None),
            "tread_min": np.clip(rng.normal(cfg["tread"], 5.0, days), 0, None),
            "cycle_min": np.clip(rng.normal(cfg["cycle"], 4.0, days), 0, None),
        }
    )


def _ema(values: np.ndarray, span: int = LOAD_MEMORY_DAYS) -> np.ndarray:
    values = np.asarray(values, float)
    if values.size == 0:
        return values
    alpha = 2.0 / (span + 1.0)
    out = np.empty_like(values)
    acc = values[0]
    for i, value in enumerate(values):
        acc = alpha * value + (1 - alpha) * acc
        out[i] = acc
    return out


def _weighted_load(df: pd.DataFrame) -> np.ndarray:
    return sum(df[column].to_numpy(float) * weight for column, weight in WEIGHTS.items())


def _validate_exercise_log(log: pd.DataFrame) -> pd.DataFrame:
    if not isinstance(log, pd.DataFrame):
        raise TypeError("log must be a pandas DataFrame")
    missing = [column for column in WEIGHTS if column not in log.columns]
    if missing:
        raise ValueError(f"missing exercise column(s): {', '.join(missing)}")
    if len(log) < 3:
        raise ValueError("need at least 3 days of exercise data")

    result = log.copy().reset_index(drop=True)
    for column in WEIGHTS:
        values = pd.to_numeric(result[column], errors="coerce")
        if values.isna().any() or (values < 0).any():
            raise ValueError(
                f"{column} contains missing or negative values; repair the exercise log first"
            )
        result[column] = values.astype(float)
    return result


def _risk_label(value: float) -> str:
    low, medium = RISK_THRESHOLDS
    return "LOW" if value < low else "MEDIUM" if value < medium else "HIGH"


@dataclass
class BoneHealthModel:
    """Deterministic simulated bone-load model.

    ``metrics`` records the calibration constants so a report can disclose the
    model's assumptions rather than implying clinical validation.
    """

    target_load: float = TARGET_LOAD
    max_monthly_loss_pct: float = MAX_MONTHLY_LOSS_PCT
    memory_days: int = LOAD_MEMORY_DAYS
    metrics: dict = field(
        default_factory=lambda: {
            "model_type": "deterministic_load_response",
            "training_data": "SIMULATED",
            "target_load": TARGET_LOAD,
            "max_monthly_loss_pct": MAX_MONTHLY_LOSS_PCT,
            "memory_days": LOAD_MEMORY_DAYS,
        }
    )

    @classmethod
    def train(cls, n_astronauts: int = 0, seed: int = 0, verbose: bool = False):
        """Return a calibrated model.

        No supervised training is performed. The argument list is retained so
        existing callers do not break.
        """
        model = cls()
        if verbose:
            print(
                "Bone model: deterministic load-response (simulated calibration); "
                f"target load={TARGET_LOAD:.1f}, max loss={MAX_MONTHLY_LOSS_PCT:.1f}%/month"
            )
        return model

    def save(self, path: str = MODEL_PATH) -> None:
        payload = {
            "target_load": self.target_load,
            "max_monthly_loss_pct": self.max_monthly_loss_pct,
            "memory_days": self.memory_days,
            "metrics": self.metrics,
        }
        with open(path, "w", encoding="utf-8") as handle:
            json.dump(payload, handle, indent=2)

    @classmethod
    def load_or_train(cls, path: str = MODEL_PATH, **kwargs):
        try:
            with open(path, "r", encoding="utf-8") as handle:
                payload = json.load(handle)
            return cls(
                target_load=float(payload.get("target_load", TARGET_LOAD)),
                max_monthly_loss_pct=float(
                    payload.get("max_monthly_loss_pct", MAX_MONTHLY_LOSS_PCT)
                ),
                memory_days=int(payload.get("memory_days", LOAD_MEMORY_DAYS)),
                metrics=payload.get("metrics") or {},
            )
        except (OSError, ValueError, TypeError, json.JSONDecodeError):
            model = cls.train(**kwargs)
            try:
                model.save(path)
            except OSError:
                pass
            return model

    def analyze(self, log: pd.DataFrame) -> dict:
        frame = _validate_exercise_log(log)
        load = _weighted_load(frame)
        memory = _ema(load, self.memory_days)

        sensitivity = 1.0
        deficit = np.clip(1.0 - memory / self.target_load, 0.0, 1.0)
        daily_rate = (self.max_monthly_loss_pct / 30.0) * sensitivity * deficit
        cumulative = np.cumsum(np.clip(daily_rate, 0.0, None))

        recent_load = float(np.mean(load[-HORIZON_DAYS:]))
        recent_memory = float(memory[-1])
        # Project forward holding current loading constant.
        projected_deficit = float(np.clip(1.0 - recent_memory / self.target_load, 0.0, 1.0))
        predicted_next30 = (self.max_monthly_loss_pct / 30.0) * projected_deficit * HORIZON_DAYS
        est_cumulative = float(cumulative[-1] + predicted_next30)
        risk = _risk_label(float(predicted_next30))

        window = min(14, len(load))
        slope = (
            float(np.polyfit(np.arange(window), load[-window:], 1)[0])
            if window >= 3
            else 0.0
        )
        below_target = load < TARGET_TOLERANCE * self.target_load
        streak = 0
        for flag in below_target[::-1]:
            if not flag:
                break
            streak += 1

        increasing_risk = bool(
            slope < -0.15 and recent_load < TARGET_TOLERANCE * self.target_load
        )
        direction = "falling" if slope < -0.15 else "rising" if slope > 0.15 else "stable"

        alerts: list[str] = []
        if risk != "LOW":
            alerts.append(
                f"Predicted bone loss over the next 30 days: {predicted_next30:.2f}% "
                "(simulated load-response model)."
            )
        if streak >= 7:
            alerts.append(f"Bone loading below target for {streak} days in a row.")
        if increasing_risk:
            alerts.append("Bone loading is trending down and remains below target.")

        bone_index = pd.Series(np.maximum(0.0, 100.0 - cumulative), name="bone_health_index")

        return {
            "predicted_loss_next30": round(float(predicted_next30), 3),
            "est_cumulative_loss": round(est_cumulative, 3),
            "risk_level": risk,
            "site_risk": {
                "hip": risk,
                "spine": "HIGH" if streak >= 14 else risk,
                "model_note": "Site labels are heuristic, not DXA measurements.",
            },
            "trend": {
                "increasing_degradation_risk": increasing_risk,
                "direction": direction,
                "slope_load_per_day": round(slope, 4),
            },
            "bone_health_index": bone_index,
            "alerts": alerts,
            "metrics": dict(self.metrics),
            "is_simulated": True,
        }
