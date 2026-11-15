"""
astronaut_health.py - one-call health monitor for an astronaut's daily log.

Monitored parameters (11):
    blood pressure, SpO2, body temperature, sleep, stress, radiation,
    muscle loss, bone loss, hydration/water intake, nutrition/calories and
    heart rate.

Each parameter gets a status (NORMAL / WATCH / ALERT / NO_DATA), a trend,
plain-English alerts and suggested countermeasures. A deterministic combined
readiness report produces FINE / CAUTION / DANGER / NO SIGNAL.

Keep this file next to bone_health.py (bone loss is reused from it).

HOW TO USE
----------
    from astronaut_health import AstronautHealthMonitor
    monitor = AstronautHealthMonitor.load_or_train()   # trains muscle model once
    report = monitor.analyze(daily_log_df)

    report["condition"]          # "FINE" | "CAUTION" | "DANGER" | "NO SIGNAL"  (health bar label;
                                 #  NO SIGNAL = 4+ of the 11 areas have no usable data)
    report["readiness"]          # 0-100                           (health bar fill)
    report["domains"]["spo2"]    # {"status", "summary", "trend", "alerts", "actions"}

DAILY LOG COLUMNS (one row per day, oldest first; every column is optional -
a domain with no data returns status "NO_DATA")
    day, resist_min, tread_min, cycle_min          exercise minutes (bone + muscle)
    systolic, diastolic                            mmHg
    spo2                                           %
    body_temp                                      deg C
    sleep_hours                                    hours slept
    resting_hr / heart_rate                        BPM (heart rate + stress score)
    hrv_ms, stress_self                            optional inputs for the stress score
    radiation_msv                                  daily dose equivalent, mSv/day
    water_l / hydration                            water intake, L/day
    calories_kcal / nutrition                      energy intake, kcal/day

WHAT IS REAL AND WHAT IS ASSUMED - say this when presenting
    * Blood pressure, SpO2, temperature, sleep: rule-based flags using common
      clinical-style cut-offs. They are PLACEHOLDERS for a prototype - confirm
      them with a clinician or a cited guideline before claiming accuracy.
    * Stress: a transparent composite score (weights are my assumptions), not a
      validated psychological measure.
    * Radiation: simple accounting against NASA's 600 mSv career limit plus a
      spike detector for solar particle events. Confirm the limit and typical
      ISS dose rates in NASA's radiation technical brief before citing.
    * Muscle and bone: models trained on SIMULATED data (see bone_health.py).
      Muscle constants are assumptions, not published values.
    * This is a prototype, NOT medical advice. Phrase actions in the UI as
      "notify the medical chief / flight surgeon".
"""

from __future__ import annotations

import os
import sys
from dataclasses import dataclass

import numpy as np
import pandas as pd

try:  # direct script execution (python_engine on sys.path)
    from bone_health import HORIZON_DAYS, MISSION_DAYS, TARGET_TOLERANCE, BoneHealthModel
    from bone_health import PROFILES as EXERCISE_PROFILES
    from bone_health import simulate_logs
except ImportError:  # package execution (python -m python_engine...)
    from .bone_health import HORIZON_DAYS, MISSION_DAYS, TARGET_TOLERANCE, BoneHealthModel
    from .bone_health import PROFILES as EXERCISE_PROFILES
    from .bone_health import simulate_logs

STATUS = ("NORMAL", "WATCH", "ALERT")


# ----------------------------------------------------------------------------
# THRESHOLDS  (all editable placeholders - see docstring)
# ----------------------------------------------------------------------------
BP = {"high_alert": (140, 90), "high_watch": (130, 80), "low_alert": (90, 60), "low_watch": (100, None),
      "spike": (160, 100), "drift_watch_mmhg": 10}
SPO2 = {"watch_mean": 95.0, "alert_mean": 92.0, "alert_min": 90.0}
TEMP = {"watch_high": 37.5, "alert_high": 38.0, "watch_low": 36.0, "alert_low": 35.5}
SLEEP = {"target": 7.0, "watch_mean": 6.5, "alert_mean": 5.5, "irregular_sd": 1.5, "debt_watch": 10.0}
STRESS = {"watch": 35.0, "alert": 60.0,
          # Prototype escalation guard: a severe self-report must not disappear
          # into the weighted composite when other inputs look normal. These are
          # policy placeholders, not validated psychological cut-offs.
          "self_watch": 6.0, "self_alert": 8.0,
          "weights": {"sleep": 0.25, "hr": 0.20, "hrv": 0.20, "self": 0.25, "bp": 0.10}}
RADIATION = {"career_limit_msv": 600.0,       # NASA career limit (confirm before citing)
             "rate_watch_msv_day": 1.0,        # PLACEHOLDER
             "spike_multiple": 5.0, "spike_floor_msv": 2.0,   # PLACEHOLDERS for SPE detection
             "watch_pct": 50.0, "alert_pct": 80.0}
# Hydration and nutrition values are prototype operational targets, not clinical
# prescriptions. They mirror the existing demonstration rules in the web app.
HYDRATION = {"target_l": 2.4, "watch_l": 1.8, "alert_l": 1.1, "irregular_sd": 0.7}
NUTRITION = {"target_kcal": 2400, "watch_kcal": 1900, "alert_kcal": 1400}
HEART_RATE = {"watch_low": 48, "watch_high": 100, "alert_low": 40,
              "alert_high": 125, "persistence_samples": 2, "spike_margin": 20}

READINESS_PENALTY = {"WATCH": 6, "ALERT": 15}
CONDITION_BANDS = ((80, "FINE"), (50, "CAUTION"), (0, "DANGER"))
# A critical alert in one of these domains must never be hidden by a high
# aggregate score. Non-critical ALERTs force at least CAUTION.
CRITICAL_DOMAINS = ("blood_pressure", "spo2", "body_temp", "heart_rate", "radiation")

ACTIONS = {
    "blood_pressure": "Re-measure at rest; notify the medical chief if the reading persists.",
    "spo2": "Check sensor fit and cabin O2/CO2 levels; notify the medical chief if it stays low.",
    "body_temp": "Re-measure at rest; report any fever to the medical chief.",
    "sleep": "Protect the sleep window (light, noise, schedule); review the timeline with the medical chief.",
    "stress": "Schedule a rest block and a private support conference; reduce non-critical tasks.",
    "radiation": "Follow storm-shelter procedure / move to the most shielded area; review the exposure plan.",
    "muscle": "Add or lengthen resistance (ARED) sessions as prescribed; check protein and calorie intake.",
    "bone": "Add or lengthen resistance (ARED) sessions as prescribed; check calorie and vitamin D intake.",
    "hydration": "Increase water/electrolyte intake toward the daily target; review the fluid log with the medical chief.",
    "nutrition": "Increase energy intake toward predicted expenditure; review the meal log with the medical chief.",
    "heart_rate": "Rest, re-measure after 5 minutes and review the cardiac trend with the medical chief.",
}

# Human-readable parameter metadata used by the API and the UI. "source" states
# where a prototype rule came from; none of these are claimed to be validated
# flight rules or diagnostic thresholds.
PARAMETER_DEFINITIONS = {
    "blood_pressure": {
        "label": "Blood Pressure", "unit": "mmHg",
        "source": "Prototype clinical-style cut-offs (placeholder; confirm with a clinician).",
    },
    "spo2": {
        "label": "SpO2", "unit": "%",
        "source": "Prototype pulse-oximetry cut-offs (placeholder; not a diagnostic rule).",
    },
    "body_temp": {
        "label": "Body Temperature", "unit": "deg C",
        "source": "Prototype temperature cut-offs (placeholder).",
    },
    "sleep": {
        "label": "Sleep", "unit": "hours/day",
        "source": "Prototype sleep-duration and regularity targets (placeholder).",
    },
    "stress": {
        "label": "Stress", "unit": "index 0-100",
        "source": "Transparent composite of sleep, HR, HRV, self-report and BP; weights and the self-report escalation guard are prototype assumptions.",
    },
    "radiation": {
        "label": "Radiation Exposure", "unit": "mSv/day",
        "source": "Dose accounting against a 600 mSv career reference plus a prototype spike detector.",
    },
    "muscle": {
        "label": "Muscle Loss", "unit": "% predicted",
        "source": "Model trained on SIMULATED labels; constants are engineering assumptions.",
    },
    "bone": {
        "label": "Bone Loss", "unit": "% predicted",
        "source": "Deterministic load-response model calibrated on SIMULATED data.",
    },
    "hydration": {
        "label": "Hydration / Water Intake", "unit": "L/day",
        "source": "Prototype operational target (2.4 L/day), not an individualized prescription.",
    },
    "nutrition": {
        "label": "Nutrition / Calories", "unit": "kcal/day",
        "source": "Prototype energy-intake target (2400 kcal/day), not an individualized prescription.",
    },
    "heart_rate": {
        "label": "Heart Rate", "unit": "BPM",
        "source": "Prototype resting heart-rate bounds (placeholder; exclude exertion artefacts).",
    },
}


# ----------------------------------------------------------------------------
# small helpers
# ----------------------------------------------------------------------------
def _col(log: pd.DataFrame, name: str):
    return pd.to_numeric(log[name], errors="coerce").to_numpy(float) if name in log.columns else None


def _col_any(log: pd.DataFrame, names):
    """Return the first available numeric column from ``names``."""
    for name in names:
        values = _col(log, name)
        if values is not None:
            return values
    return None


# Physical/plausibility bounds used to reject impossible sensor values. These
# are data-quality guards, not diagnostic thresholds.
VALID_RANGES = {
    "systolic": (50.0, 300.0), "diastolic": (30.0, 200.0),
    "spo2": (50.0, 100.0), "body_temp": (30.0, 45.0),
    "sleep_hours": (0.0, 24.0), "resting_hr": (20.0, 300.0),
    "heart_rate": (20.0, 300.0), "hrv_ms": (0.0, 500.0),
    "stress_self": (0.0, 10.0), "radiation_msv": (0.0, 100.0),
    "water_l": (0.0, 15.0), "hydration": (0.0, 15.0),
    "calories_kcal": (0.0, 10000.0), "nutrition": (0.0, 10000.0),
    "resist_min": (0.0, 600.0), "tread_min": (0.0, 600.0), "cycle_min": (0.0, 600.0),
}


def validate_daily_log(log) -> dict:
    """Validate a daily log and return data-quality findings.

    Invalid numeric values are reported. The analyzer subsequently treats them
    as missing rather than silently presenting them as healthy measurements.
    """
    if not isinstance(log, pd.DataFrame):
        return {"valid": False, "errors": ["daily_log must be a pandas DataFrame"],
                "warnings": [], "invalid_columns": {}, "row_count": 0}
    errors, warnings, invalid = [], [], {}
    if len(log) < 3:
        errors.append("need at least 3 rows of monitoring data")
    for column in log.columns:
        if column == "day":
            continue
        numeric = pd.to_numeric(log[column], errors="coerce")
        count = int(numeric.isna().sum())
        if count:
            warnings.append(f"{column}: {count} missing/non-numeric value(s)")
        if column in VALID_RANGES:
            low, high = VALID_RANGES[column]
            out = int((numeric.notna() & ((numeric < low) | (numeric > high))).sum())
            if out:
                invalid[column] = out
                errors.append(
                    f"{column}: {out} value(s) outside plausibility bounds [{low}, {high}]"
                )
        elif count and count == len(log):
            warnings.append(f"{column}: no usable values")
    return {"valid": not errors, "errors": errors, "warnings": warnings,
            "invalid_columns": invalid, "row_count": int(len(log))}


def _sanitize_log(log: pd.DataFrame):
    """Normalize numeric columns and blank implausible values, returning counts."""
    clean = log.copy().reset_index(drop=True)
    invalid = {}
    for column in clean.columns:
        if column == "day":
            continue
        values = pd.to_numeric(clean[column], errors="coerce")
        if column in VALID_RANGES:
            low, high = VALID_RANGES[column]
            mask = values.notna() & ((values < low) | (values > high))
            count = int(mask.sum())
            if count:
                invalid[column] = count
                values = values.mask(mask)
        clean[column] = values
    return clean, invalid


def _slope(x, n: int = 14) -> float:
    x = np.asarray(x, float)[-n:]
    x = x[~np.isnan(x)]
    return float(np.polyfit(np.arange(len(x)), x, 1)[0]) if len(x) >= 3 else 0.0


def _mean(x) -> float:
    x = np.asarray(x, float)
    return float(np.nanmean(x)) if x.size and not np.all(np.isnan(x)) else float("nan")


def _baseline(x) -> float:
    n = len(x)
    return _mean(x[: max(3, min(14, n // 2))])


def _worst(a: str, b: str) -> str:
    return a if STATUS.index(a) >= STATUS.index(b) else b


def _result(status, summary, trend, alerts, domain):
    return {"status": status, "summary": summary, "trend": trend, "alerts": alerts,
            "actions": [ACTIONS[domain]] if status != "NORMAL" else []}


def _no_data(domain, needs):
    return {"status": "NO_DATA", "summary": {}, "trend": {}, "alerts": [], "actions": [],
            "note": f"needs column(s): {', '.join(needs)}"}


def _direction(slope, tol):
    return "rising" if slope > tol else "falling" if slope < -tol else "stable"


STALE_DAYS = 3   # no reading for this many days in a row = stale, not "still fine"


def _stale(x, n: int = STALE_DAYS) -> bool:
    x = np.asarray(x, float)
    return len(x) > 0 and not np.isfinite(x[-n:]).any()


# ----------------------------------------------------------------------------
# PERSONAL BASELINE ANOMALY LAYER (supplements, never replaces, rule checks)
# ----------------------------------------------------------------------------
# These are engineering thresholds, not clinical cut-offs. The baseline is the
# earliest valid portion of this astronaut's own log. The check compares the
# MEAN OF THE LAST 3 DAYS (not one noisy reading), only in the HARMFUL direction
# for each vital, and never goes above WATCH on its own (the absolute rules own
# ALERT). Each vital has a minimum spread so a sensor that reports whole numbers
# (baseline spread ~0) cannot turn a 1-point change into a huge z-score.
PERSONAL_BASELINE = {"min_baseline": 7, "max_baseline": 30, "recent_days": 3, "watch_robust_z": 3.0}
# domain: (column, label, harmful direction [+1 = rising is bad, -1 = falling is bad], minimum spread)
PERSONAL_COLUMNS = {
    "blood_pressure": ("systolic", "Systolic BP", +1, 5.0),
    "spo2": ("spo2", "SpO2", -1, 1.0),
    "body_temp": ("body_temp", "Body temperature", +1, 0.2),
    "sleep": ("sleep_hours", "Sleep duration", -1, 0.5),
    "stress": ("resting_hr", "Resting heart rate", +1, 3.0),
    "hydration": ("water_l", "Water intake", -1, 0.2),
    "nutrition": ("calories_kcal", "Energy intake", -1, 100.0),
    "heart_rate": ("resting_hr", "Resting heart rate", +1, 3.0),
}


def _personal_anomaly(log: pd.DataFrame, column: str, direction: int, min_spread: float):
    """Interpretable robust-z comparison of the last 3 days with the early baseline, or None."""
    x = _col(log, column)
    if x is None:
        return None
    k = PERSONAL_BASELINE["recent_days"]
    recent_vals = x[-k:][np.isfinite(x[-k:])]
    valid = x[np.isfinite(x)]
    base_n = min(PERSONAL_BASELINE["max_baseline"], max(PERSONAL_BASELINE["min_baseline"], len(valid) // 3))
    if not len(recent_vals) or len(valid) < base_n + k:      # baseline must not overlap the recent window
        return None
    baseline = valid[:base_n]
    recent = float(recent_vals.mean())
    med = float(np.median(baseline))
    mad = float(np.median(np.abs(baseline - med)))
    scale = max(1.4826 * mad, min_spread)
    z = direction * (recent - med) / scale
    return {"baseline_median": round(med, 3), "recent_mean_3d": round(recent, 3),
            "harmful_z": round(float(z), 2), "baseline_points": int(base_n),
            "flag": "WATCH" if z >= PERSONAL_BASELINE["watch_robust_z"] else "NORMAL"}


def add_personal_baseline(domain_result: dict, log: pd.DataFrame, domain: str):
    spec = PERSONAL_COLUMNS.get(domain)
    if not spec or domain_result["status"] == "NO_DATA":      # never override a NO_DATA domain
        return domain_result
    col, label, direction, min_spread = spec
    anomaly = _personal_anomaly(log, col, direction, min_spread)
    if anomaly is None:
        domain_result["personal_baseline"] = {"available": False,
                                              "reason": "Needs 7+ early baseline readings plus the last 3 days."}
        return domain_result
    domain_result["personal_baseline"] = {"available": True, **anomaly}
    if anomaly["flag"] != "NORMAL":
        domain_result["status"] = _worst(domain_result["status"], "WATCH")
        word = "above" if direction > 0 else "below"
        msg = f"{label} over the last 3 days is {word} this astronaut's early-log baseline (z={anomaly['harmful_z']:.1f})."
        if msg not in domain_result["alerts"]:
            domain_result["alerts"].append(msg)
        action = "Review the measurement and notify the medical chief if the change persists."
        if action not in domain_result["actions"]:
            domain_result["actions"].append(action)
    return domain_result

# ----------------------------------------------------------------------------
# VITAL-SIGN DOMAINS (rule-based, easy to explain)
# ----------------------------------------------------------------------------
def assess_blood_pressure(log):
    s, d = _col(log, "systolic"), _col(log, "diastolic")
    if s is None or d is None:
        return _no_data("blood_pressure", ["systolic", "diastolic"])
    if _stale(s) or _stale(d) or not np.isfinite(s).any() or not np.isfinite(d).any():
        return _no_data("blood_pressure", [f"systolic and diastolic readings from the last {STALE_DAYS} days"])
    s7, d7 = _mean(s[-7:]), _mean(d[-7:])
    status, alerts = "NORMAL", []
    if s7 >= BP["high_alert"][0] or d7 >= BP["high_alert"][1]:
        status, alerts = "ALERT", [f"7-day average {s7:.0f}/{d7:.0f} mmHg is in the high range."]
    elif s7 >= BP["high_watch"][0] or d7 >= BP["high_watch"][1]:
        status, alerts = "WATCH", [f"7-day average {s7:.0f}/{d7:.0f} mmHg is elevated."]
    if s7 < BP["low_alert"][0] or d7 < BP["low_alert"][1]:
        status, alerts = "ALERT", [f"7-day average {s7:.0f}/{d7:.0f} mmHg is low."]
    elif s7 < BP["low_watch"][0]:
        status, alerts = _worst(status, "WATCH"), alerts + [f"Systolic average {s7:.0f} mmHg is on the low side."]
    if np.nanmax(s[-3:]) >= BP["spike"][0] or np.nanmax(d[-3:]) >= BP["spike"][1]:
        status, alerts = "ALERT", alerts + ["Very high reading in the last 3 days."]
    if len(s) >= 21:
        drift = s7 - _baseline(s)
        if drift >= BP["drift_watch_mmhg"]:
            status, alerts = _worst(status, "WATCH"), alerts + [f"Systolic is {drift:.0f} mmHg above this astronaut's own baseline."]
    slope = _slope(s)
    return _result(status, {"systolic_7d": round(s7, 1), "diastolic_7d": round(d7, 1)},
                   {"systolic_slope_mmHg_per_day": round(slope, 3), "direction": _direction(slope, 0.3)},
                   alerts, "blood_pressure")


def assess_spo2(log):
    x = _col(log, "spo2")
    if x is None:
        return _no_data("spo2", ["spo2"])
    if _stale(x) or not np.isfinite(x).any():
        return _no_data("spo2", [f"spo2 readings from the last {STALE_DAYS} days"])
    m3, mn3 = _mean(x[-3:]), float(np.nanmin(x[-3:]))
    status, alerts = "NORMAL", []
    if mn3 < SPO2["alert_min"] or m3 < SPO2["alert_mean"]:
        status, alerts = "ALERT", [f"SpO2 down to {mn3:.0f}% (3-day mean {m3:.1f}%)."]
    elif m3 < SPO2["watch_mean"] or mn3 < SPO2["alert_mean"]:
        status, alerts = "WATCH", [f"SpO2 3-day mean {m3:.1f}% is below the normal range."]
    slope = _slope(x)
    return _result(status, {"mean_3d": round(m3, 1), "min_3d": round(mn3, 1)},
                   {"slope_per_day": round(slope, 3), "direction": _direction(slope, 0.1)}, alerts, "spo2")


def assess_body_temp(log):
    x = _col(log, "body_temp")
    if x is None:
        return _no_data("body_temp", ["body_temp"])
    valid = np.flatnonzero(np.isfinite(x))
    if not len(valid) or _stale(x):
        return _no_data("body_temp", [f"body_temp readings from the last {STALE_DAYS} days"])
    last, m3 = float(x[valid[-1]]), _mean(x[-3:])
    status, alerts = "NORMAL", []
    if last >= TEMP["alert_high"] or last < TEMP["alert_low"]:
        status, alerts = "ALERT", [f"Body temperature {last:.1f} C is outside the safe range."]
    elif last >= TEMP["watch_high"] or m3 >= TEMP["watch_high"] or last < TEMP["watch_low"]:
        status, alerts = "WATCH", [f"Body temperature {last:.1f} C (3-day mean {m3:.1f} C) is slightly off."]
    slope = _slope(x, 7)
    return _result(status, {"latest": round(last, 2), "mean_3d": round(m3, 2)},
                   {"slope_C_per_day": round(slope, 3), "direction": _direction(slope, 0.05)}, alerts, "body_temp")


def assess_sleep(log):
    h = _col(log, "sleep_hours")
    if h is None:
        return _no_data("sleep", ["sleep_hours"])
    if _stale(h) or not np.isfinite(h).any():
        return _no_data("sleep", [f"sleep_hours readings from the last {STALE_DAYS} days"])
    m7, sd7 = _mean(h[-7:]), float(np.nanstd(h[-7:]))
    debt = float(np.nansum(np.clip(SLEEP["target"] - h[-14:], 0, None)))
    status, alerts = "NORMAL", []
    if m7 < SLEEP["alert_mean"]:
        status, alerts = "ALERT", [f"Averaging only {m7:.1f} h of sleep over the last 7 days."]
    elif m7 < SLEEP["watch_mean"]:
        status, alerts = "WATCH", [f"Averaging {m7:.1f} h of sleep over the last 7 days."]
    if debt > SLEEP["debt_watch"]:
        status, alerts = _worst(status, "WATCH"), alerts + [f"Sleep debt of {debt:.0f} h over the last 14 days."]
    if sd7 > SLEEP["irregular_sd"]:
        status, alerts = _worst(status, "WATCH"), alerts + ["Sleep duration is very irregular."]
    slope = _slope(h)
    return _result(status, {"mean_7d_h": round(m7, 2), "sleep_debt_14d_h": round(debt, 1)},
                   {"slope_h_per_day": round(slope, 3), "direction": _direction(slope, 0.03)}, alerts, "sleep")


def _stress_at(log, t: int):
    """Stress score 0-100 using data up to row t (inclusive). None if no inputs."""
    sl = slice(max(0, t - 6), t + 1)
    comps = {}
    h = _col(log, "sleep_hours")
    if h is not None:
        comps["sleep"] = np.clip((SLEEP["target"] - _mean(h[sl])) / 3.0, 0, 1)
    hr = _col(log, "resting_hr")
    if hr is not None:
        comps["hr"] = np.clip((_mean(hr[sl]) - _baseline(hr[: t + 1])) / 15.0, 0, 1)
    hrv = _col(log, "hrv_ms")
    if hrv is not None:
        base = _baseline(hrv[: t + 1])
        comps["hrv"] = np.clip((base - _mean(hrv[sl])) / base / 0.4, 0, 1) if base > 0 else 0.0
    st = _col(log, "stress_self")
    if st is not None:
        comps["self"] = np.clip(_mean(st[sl]) / 10.0, 0, 1)
    s = _col(log, "systolic")
    if s is not None:
        comps["bp"] = np.clip((_mean(s[sl]) - _baseline(s[: t + 1])) / 20.0, 0, 1)
    comps = {k: v for k, v in comps.items() if not np.isnan(v)}
    if not comps:
        return None, {}
    w = STRESS["weights"]
    score = 100.0 * sum(w[k] * v for k, v in comps.items()) / sum(w[k] for k in comps)
    return float(score), {k: round(float(v), 2) for k, v in comps.items()}


def assess_stress(log):
    n = len(log)
    score, parts = _stress_at(log, n - 1)
    if score is None:
        return _no_data("stress", ["sleep_hours / resting_hr / hrv_ms / stress_self / systolic"])
    series = [_stress_at(log, t)[0] for t in range(max(0, n - 14), n)]
    slope = _slope(series, 14)
    status = "ALERT" if score >= STRESS["alert"] else "WATCH" if score >= STRESS["watch"] else "NORMAL"
    alerts = []
    if status != "NORMAL":
        top = max(parts, key=parts.get)
        alerts.append(f"Stress index {score:.0f}/100; biggest driver: {top}.")
    if slope > 1.0:
        alerts.append("Stress index is climbing day over day.")
        status = _worst(status, "WATCH")

    self_values = _col(log, "stress_self")
    self_3d = _mean(self_values[-3:]) if self_values is not None else float("nan")
    if np.isfinite(self_3d) and self_3d >= STRESS["self_alert"]:
        status = "ALERT"
        alerts.append(
            f"Self-reported stress {self_3d:.1f}/10 over the last 3 days is severe; "
            "this indicator independently raises the stress status."
        )
    elif np.isfinite(self_3d) and self_3d >= STRESS["self_watch"]:
        status = _worst(status, "WATCH")
        alerts.append(
            f"Self-reported stress {self_3d:.1f}/10 over the last 3 days is elevated."
        )

    return _result(status, {"stress_index": round(score, 1), "self_report_3d": round(self_3d, 1)
                            if np.isfinite(self_3d) else None, "drivers": parts},
                   {"slope_per_day": round(slope, 3), "direction": _direction(slope, 0.5)}, alerts, "stress")


def assess_radiation(log, prior_career_msv: float = 0.0):
    d = _col(log, "radiation_msv")
    if d is None:
        return _no_data("radiation", ["radiation_msv"])
    if not np.isfinite(prior_career_msv) or prior_career_msv < 0:
        raise ValueError("prior_career_msv must be a finite, non-negative number")
    if np.any(np.isfinite(d) & (d < 0)):
        return {**_no_data("radiation", ["non-negative radiation_msv values"]),
                "note": "radiation_msv contains negative values; correct the input before analysis."}
    if _stale(d) or not np.isfinite(d).any():
        return _no_data("radiation", [f"radiation_msv readings from the last {STALE_DAYS} days"])
    cum = float(np.nansum(d))
    total = prior_career_msv + cum
    pct = 100.0 * total / RADIATION["career_limit_msv"]
    rate7 = _mean(d[-7:])
    ref = float(np.nanmedian(d[:-3])) if len(d) > 6 else float(np.nanmedian(d))
    spike_level = max(RADIATION["spike_multiple"] * ref, RADIATION["spike_floor_msv"])
    spike = bool(np.nanmax(d[-3:]) > spike_level)
    days_left = (RADIATION["career_limit_msv"] - total) / rate7 if rate7 > 0 else float("inf")
    status, alerts = "NORMAL", []
    if spike:
        status, alerts = "ALERT", [f"Dose spike ({np.nanmax(d[-3:]):.1f} mSv/day vs typical {ref:.2f}): possible solar particle event."]
    if pct >= RADIATION["alert_pct"]:
        status, alerts = "ALERT", alerts + [f"{pct:.0f}% of the career limit used."]
    elif pct >= RADIATION["watch_pct"]:
        status, alerts = _worst(status, "WATCH"), alerts + [f"{pct:.0f}% of the career limit used."]
    if rate7 > RADIATION["rate_watch_msv_day"]:
        status, alerts = _worst(status, "WATCH"), alerts + [f"Dose rate {rate7:.2f} mSv/day is above the expected range."]
    return _result(status,
                   {"mission_dose_msv": round(cum, 1), "career_limit_used_pct": round(pct, 1),
                    "rate_7d_msv_per_day": round(rate7, 3),
                    "days_to_limit_at_current_rate": None if np.isinf(days_left) else int(days_left)},
                   {"spike_detected": spike, "direction": _direction(_slope(d, 7), 0.01)}, alerts, "radiation")


# ----------------------------------------------------------------------------
# HYDRATION, NUTRITION AND HEART RATE
# ----------------------------------------------------------------------------
def assess_hydration(log):
    x = _col_any(log, ("water_l", "hydration"))
    if x is None:
        return _no_data("hydration", ["water_l or hydration"])
    if _stale(x) or not np.isfinite(x).any():
        return _no_data("hydration", [f"water_l/hydration readings from the last {STALE_DAYS} days"])
    m7 = _mean(x[-7:])
    sd7 = float(np.nanstd(x[-7:]))
    last_valid = x[np.isfinite(x)][-1]
    status, alerts = "NORMAL", []
    if m7 < HYDRATION["alert_l"] or last_valid < HYDRATION["alert_l"]:
        status = "ALERT"
        alerts.append(f"7-day water intake average {m7:.2f} L/day is critically low.")
    elif m7 < HYDRATION["watch_l"] or last_valid < HYDRATION["watch_l"]:
        status = "WATCH"
        alerts.append(f"7-day water intake average {m7:.2f} L/day is below target.")
    if sd7 > HYDRATION["irregular_sd"]:
        status = _worst(status, "WATCH")
        alerts.append("Daily water intake is highly irregular.")
    slope = _slope(x)
    return _result(status, {"mean_7d_l": round(m7, 2), "latest_l": round(float(last_valid), 2),
                            "target_l": HYDRATION["target_l"]},
                   {"slope_l_per_day": round(slope, 3), "direction": _direction(slope, 0.02)},
                   alerts, "hydration")


def assess_nutrition(log):
    x = _col_any(log, ("calories_kcal", "nutrition"))
    if x is None:
        return _no_data("nutrition", ["calories_kcal or nutrition"])
    if _stale(x) or not np.isfinite(x).any():
        return _no_data("nutrition", [f"calories_kcal/nutrition readings from the last {STALE_DAYS} days"])
    m7 = _mean(x[-7:])
    last_valid = x[np.isfinite(x)][-1]
    status, alerts = "NORMAL", []
    if m7 < NUTRITION["alert_kcal"] or last_valid < NUTRITION["alert_kcal"]:
        status = "ALERT"
        alerts.append(f"7-day energy intake average {m7:.0f} kcal/day is critically low.")
    elif m7 < NUTRITION["watch_kcal"] or last_valid < NUTRITION["watch_kcal"]:
        status = "WATCH"
        alerts.append(f"7-day energy intake average {m7:.0f} kcal/day is below target.")
    slope = _slope(x)
    return _result(status, {"mean_7d_kcal": round(m7, 0), "latest_kcal": round(float(last_valid), 0),
                            "target_kcal": NUTRITION["target_kcal"]},
                   {"slope_kcal_per_day": round(slope, 1), "direction": _direction(slope, 5.0)},
                   alerts, "nutrition")


def assess_heart_rate(log):
    x = _col_any(log, ("heart_rate", "resting_hr"))
    if x is None:
        return _no_data("heart_rate", ["heart_rate or resting_hr"])
    if _stale(x) or not np.isfinite(x).any():
        return _no_data("heart_rate", [f"heart rate readings from the last {STALE_DAYS} days"])
    valid = x[np.isfinite(x)]
    m3 = _mean(x[-3:])
    last = float(valid[-1])
    recent = x[-HEART_RATE["persistence_samples"]:]
    recent_valid = recent[np.isfinite(recent)]
    sustained_high = len(recent_valid) >= HEART_RATE["persistence_samples"] and bool(
        np.all(recent_valid >= HEART_RATE["watch_high"])
    )
    sustained_low = len(recent_valid) >= HEART_RATE["persistence_samples"] and bool(
        np.all(recent_valid <= HEART_RATE["watch_low"])
    )
    status, alerts = "NORMAL", []
    if (m3 >= HEART_RATE["alert_high"] or last >= HEART_RATE["alert_high"]
            or m3 <= HEART_RATE["alert_low"] or last <= HEART_RATE["alert_low"]):
        status = "ALERT"
        alerts.append(f"Heart rate {last:.0f} BPM (3-day mean {m3:.0f}) is outside the critical range.")
    elif sustained_high or sustained_low or m3 >= HEART_RATE["watch_high"] or m3 <= HEART_RATE["watch_low"]:
        status = "WATCH"
        alerts.append(f"Heart rate {last:.0f} BPM (3-day mean {m3:.0f}) is outside the expected range.")
    if len(valid) >= 7:
        baseline = _baseline(valid)
        if last - baseline >= HEART_RATE["spike_margin"]:
            status = _worst(status, "WATCH")
            alerts.append(f"Heart rate is {last - baseline:.0f} BPM above this astronaut's baseline.")
    slope = _slope(x)
    return _result(status, {"latest_bpm": round(last, 0), "mean_3d_bpm": round(m3, 0)},
                   {"slope_bpm_per_day": round(slope, 3), "direction": _direction(slope, 0.5)},
                   alerts, "heart_rate")


# ----------------------------------------------------------------------------
# MUSCLE LOSS  (same idea as bone_health.py: exercise loading -> predicted loss)
# ----------------------------------------------------------------------------
@dataclass(frozen=True)
class LoadCfg:
    name: str
    weights: dict
    target: float          # weighted load/day that fully protects the tissue   (PLACEHOLDER)
    memory: int            # days of loading history the tissue "remembers"     (PLACEHOLDER)
    max_monthly_loss: float  # % loss/month with no loading                      (PLACEHOLDER)
    thresholds: tuple      # next-30-day % loss: < a LOW, < b MEDIUM, else HIGH   (PLACEHOLDER)


MUSCLE_CFG = LoadCfg("muscle", {"resist_min": 0.7, "tread_min": 0.25, "cycle_min": 0.05},
                     target=40.0, memory=10, max_monthly_loss=3.0, thresholds=(0.5, 1.5))
MUSCLE_FEATURES = ["day", "load_mean_30", "load_mean_all", "frac_below_30", "load_slope_30", "load_ema"]
MUSCLE_MODEL_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "muscle_model.joblib")


def _load(df, cfg):
    return sum(df[c].to_numpy(float) * w for c, w in cfg.weights.items())


def _ema(x, span):
    a, acc, out = 2.0 / (span + 1.0), x[0], np.empty(len(x))
    for i, v in enumerate(x):
        acc = a * v + (1 - a) * acc
        out[i] = acc
    return out


def _load_features(df, t, cfg):
    load = _load(df, cfg)
    w = load[max(0, t - 29): t + 1]
    return {"day": float(t + 1), "load_mean_30": float(w.mean()), "load_mean_all": float(load[: t + 1].mean()),
            "frac_below_30": float((w < cfg.target).mean()),
            "load_slope_30": float(np.polyfit(np.arange(len(w)), w, 1)[0]) if len(w) >= 3 else 0.0,
            "load_ema": float(_ema(load[: t + 1], cfg.memory)[-1])}


def _risk_label(v, cfg):
    return "LOW" if v < cfg.thresholds[0] else "MEDIUM" if v < cfg.thresholds[1] else "HIGH"


def _loss_curve(df, cfg, rng):
    ema = _ema(_load(df, cfg), cfg.memory)
    sens = float(np.clip(rng.normal(1.0, 0.2), 0.5, 1.6))
    rate = (cfg.max_monthly_loss / 30.0) * sens * np.clip(1 - ema / cfg.target, 0, 1)
    return np.cumsum(np.clip(rate + rng.normal(0, 0.005, len(rate)), 0, None))


@dataclass
class MuscleModel:
    reg30: object
    regc: object
    metrics: dict
    cfg: LoadCfg = MUSCLE_CFG

    @classmethod
    def train(cls, n_astronauts: int = 1000, seed: int = 11, verbose: bool = True):
        from sklearn.ensemble import GradientBoostingRegressor
        from sklearn.metrics import mean_absolute_error, r2_score
        from sklearn.model_selection import GroupShuffleSplit

        cfg, rng, rows = MUSCLE_CFG, np.random.default_rng(seed), []
        for aid in range(n_astronauts):
            df = simulate_logs(EXERCISE_PROFILES[aid % len(EXERCISE_PROFILES)], MISSION_DAYS, rng)
            cum = _loss_curve(df, cfg, rng)
            for t in rng.choice(np.arange(20, MISSION_DAYS - HORIZON_DAYS), size=12, replace=False):
                f = _load_features(df, int(t), cfg)
                f.update(aid=aid, cum=float(cum[t]), nxt=float(cum[t + HORIZON_DAYS] - cum[t]))
                rows.append(f)
        data = pd.DataFrame(rows)
        tr, te = next(GroupShuffleSplit(test_size=0.2, random_state=seed).split(data, groups=data["aid"]))

        def fit(target):
            m = GradientBoostingRegressor(n_estimators=200, max_depth=3, learning_rate=0.05, random_state=seed)
            m.fit(data[MUSCLE_FEATURES].iloc[tr], data[target].iloc[tr])
            actual = data[target].iloc[te]
            p = m.predict(data[MUSCLE_FEATURES].iloc[te])
            baseline = np.full(len(actual), float(data[target].iloc[tr].mean()))
            baseline_mae = float(mean_absolute_error(actual, baseline))
            mae = float(mean_absolute_error(actual, p))
            return m, {"MAE": mae,
                       "R2": float(r2_score(actual, p)),
                       "baseline_MAE": baseline_mae,
                       "skill_vs_baseline_pct": round(100.0 * (1.0 - mae / baseline_mae), 1)
                       if baseline_mae > 0 else None}

        reg30, m30 = fit("nxt")
        
        regc, mc = fit("cum")
        if verbose:
            print(f"Muscle model (simulated data, held-out astronauts): next-30-day MAE={m30['MAE']:.3f}%  R2={m30['R2']:.3f}")
        return cls(reg30, regc, {
            "model_version": "muscle-gbr-v2",
            "features": MUSCLE_FEATURES,
            "seed": seed,
            "training_samples": int(len(tr)),
            "validation_samples": int(len(te)),
            "training_data": "synthetic simulated logs",
            "next30": m30,
            "cumulative": mc,
        })

    def save(self, path=MUSCLE_MODEL_PATH):
        import joblib
        joblib.dump({"reg30": self.reg30, "regc": self.regc, "metrics": self.metrics}, path)

    @classmethod
    def load_or_train(cls, path=MUSCLE_MODEL_PATH, **kw):
        import joblib
        if os.path.exists(path):
            try:
                return cls(**joblib.load(path))
            except Exception:
                pass
        m = cls.train(**kw)
        m.save(path)
        return m

    def analyze(self, log):
        need = list(self.cfg.weights)
        if any(c not in log.columns for c in need):
            return _no_data("muscle", need)
        log = log.copy().reset_index(drop=True)
        for c in need:
            values = pd.to_numeric(log[c], errors="coerce")
            if values.isna().any() or (values < 0).any():
                # missing exercise minutes are NOT zero exercise: report NO_DATA instead of a false alarm
                return {**_no_data("muscle", need),
                        "note": f"{c} has missing or negative values; repair the exercise log before muscle analysis"}
            log[c] = values
        t = len(log) - 1
        x = pd.DataFrame([_load_features(log, t, self.cfg)])[MUSCLE_FEATURES]
        nxt = float(max(0.0, self.reg30.predict(x)[0]))
        cum = float(max(0.0, self.regc.predict(x)[0]))
        load = _load(log, self.cfg)
        slope = _slope(load, 14)
        tol = TARGET_TOLERANCE * self.cfg.target     # materially below target, not just noise
        streak = 0
        for v in (load < tol)[::-1]:
            if not v:
                break
            streak += 1
        risk = _risk_label(nxt, self.cfg)
        status = {"LOW": "NORMAL", "MEDIUM": "WATCH", "HIGH": "ALERT"}[risk]
        alerts = []
        if status != "NORMAL":
            alerts.append(f"Predicted muscle loss over the next 30 days: {nxt:.2f}%.")
        if streak >= 7:
            alerts.append(f"Muscle loading below target for {streak} days in a row.")
        if slope < -0.15 and load[-14:].mean() < tol:
            status = _worst(status, "WATCH")
            alerts.append("Muscle loading is trending down and is below target.")
        return _result(status, {"predicted_loss_next30_pct": round(nxt, 2), "est_cumulative_loss_pct": round(cum, 2),
                                "risk_level": risk},
                       {"load_slope_per_day": round(slope, 3), "direction": _direction(slope, 0.15),
                        "days_below_target_streak": streak}, alerts, "muscle")


def assess_bone(log, bone_model: BoneHealthModel):
    need = ["resist_min", "tread_min", "cycle_min"]
    if any(c not in log.columns for c in need) or len(log) < 3:
        return _no_data("bone", need)
    try:
        r = bone_model.analyze(log)
    except ValueError as e:        # e.g. gaps in the exercise columns: degrade to NO_DATA, don't crash the report
        return {**_no_data("bone", need), "note": str(e)}
    status = {"LOW": "NORMAL", "MEDIUM": "WATCH", "HIGH": "ALERT"}[r["risk_level"]]
    if r["trend"]["increasing_degradation_risk"]:
        status = _worst(status, "WATCH")
    return _result(status,
                   {"predicted_loss_next30_pct": r["predicted_loss_next30"],
                    "est_cumulative_loss_pct": r["est_cumulative_loss"], "risk_level": r["risk_level"],
                    "site_risk": r["site_risk"]},
                   {"direction": r["trend"]["direction"], "load_slope_per_day": r["trend"]["slope_load_per_day"],
                    "increasing_degradation_risk": r["trend"]["increasing_degradation_risk"],
                    "bone_health_index_latest": round(float(r["bone_health_index"].iloc[-1]), 2)},
                   r["alerts"], "bone")


# ----------------------------------------------------------------------------
# PUBLIC API
# ----------------------------------------------------------------------------
@dataclass
class AstronautHealthMonitor:
    bone: BoneHealthModel
    muscle: MuscleModel

    @classmethod
    def load_or_train(cls):
        return cls(BoneHealthModel.load_or_train(), MuscleModel.load_or_train())

    def analyze(self, log: pd.DataFrame, prior_career_msv: float = 0.0,
                countermeasure_status: dict | None = None) -> dict:
        if not isinstance(log, pd.DataFrame):
            raise TypeError("daily_log must be a pandas DataFrame")
        if len(log) < 3:
            raise ValueError("need at least 3 days of data")
        validation = validate_daily_log(log)
        if any("need at least" in message for message in validation["errors"]):
            raise ValueError("need at least 3 days of data")
        # Normalize numeric sensor columns and blank physically implausible
        # values. Domain functions decide whether the remaining data is usable.
        log, invalid_values = _sanitize_log(log)
        domains = {
            "blood_pressure": assess_blood_pressure(log),
            "spo2": assess_spo2(log),
            "body_temp": assess_body_temp(log),
            "sleep": assess_sleep(log),
            "stress": assess_stress(log),
            "radiation": assess_radiation(log, prior_career_msv),
            "muscle": self.muscle.analyze(log),
            "bone": assess_bone(log, self.bone),
            "hydration": assess_hydration(log),
            "nutrition": assess_nutrition(log),
            "heart_rate": assess_heart_rate(log),
        }
        for key in PERSONAL_COLUMNS:
            domains[key] = add_personal_baseline(domains[key], log, key)

        contributions, penalties = [], []
        for key, domain in domains.items():
            status = domain["status"]
            penalty = READINESS_PENALTY.get(status, 0)
            if penalty:
                penalties.append({"parameter": key, "status": status, "penalty": penalty})
            if status in ("WATCH", "ALERT", "NO_DATA"):
                contributions.append({
                    "parameter": key,
                    "label": PARAMETER_DEFINITIONS[key]["label"],
                    "status": status,
                    "summary": domain.get("summary", {}),
                    "reason": (domain.get("alerts") or [domain.get("note", "No usable data.")])[0],
                    "critical": key in CRITICAL_DOMAINS,
                })

        readiness = max(0, 100 - sum(p["penalty"] for p in penalties))
        statuses = [d["status"] for d in domains.values()]
        missing = [k for k, d in domains.items() if d["status"] == "NO_DATA"]
        alert_domains = [k for k, d in domains.items() if d["status"] == "ALERT"]
        watch_domains = [k for k, d in domains.items() if d["status"] == "WATCH"]
        critical_alerts = [k for k in alert_domains if k in CRITICAL_DOMAINS]
        total = len(domains)

        # Missing monitoring is uncertainty, not evidence of health. Cap the
        # score so the UI cannot show a reassuring green state.
        if len(missing) >= 4:
            readiness = min(readiness, 40)
        elif missing:
            readiness = min(readiness, 70)

        if critical_alerts:
            overall = "ALERT"
        elif alert_domains:
            overall = "ALERT"
        elif watch_domains:
            overall = "WATCH"
        elif len(missing) >= 4:
            overall = "INSUFFICIENT_DATA"
        elif missing:
            overall = "LIMITED_DATA"
        else:
            overall = "NORMAL"

        condition = next(label for floor, label in CONDITION_BANDS if readiness >= floor)
        # A critical alert is never hidden by a good aggregate score.
        if critical_alerts:
            condition = "DANGER"
        elif (alert_domains or watch_domains) and condition == "FINE":
            # A WATCH is still a monitoring finding. Never label a report
            # "FINE" while a domain needs review.
            condition = "CAUTION"
        if missing and condition == "FINE":
            condition = "CAUTION"
        if len(missing) >= 4 and not alert_domains:
            condition = "NO SIGNAL"

        if condition == "DANGER":
            reason = (
                "Critical alert(s) in " + ", ".join(
                    PARAMETER_DEFINITIONS[k]["label"] for k in (critical_alerts or alert_domains)
                ) + ". Immediate Medical Chief review is required."
            )
        elif condition == "CAUTION":
            labels = [PARAMETER_DEFINITIONS[k]["label"] for k in (alert_domains + watch_domains)]
            reason = "Monitoring findings in " + ", ".join(labels) + "." if labels else (
                "Some monitoring channels are missing, so readiness cannot be confirmed."
            )
        elif condition == "NO SIGNAL":
            reason = "Too little monitoring data to assess readiness safely; no reassuring status is being shown."
        else:
            reason = "All monitored parameters with usable data are within their prototype ranges."

        countermeasures = build_countermeasures(domains, countermeasure_status)
        completed = [c for c in countermeasures if c["completionStatus"] == "COMPLETED"]
        next30 = self.muscle.metrics.get("next30", {})
        metric_note = ""
        if next30.get("MAE") is not None and next30.get("baseline_MAE") is not None:
            metric_note = (
                f" Held-out synthetic next-30-day MAE is {next30['MAE']:.2f}% versus a "
                f"{next30['baseline_MAE']:.2f}% mean-prediction baseline."
            )
        return {
            "condition": condition,
            "readiness": readiness,
            "overall_status": overall,
            "condition_reason": reason,
            "contributing_parameters": contributions,
            "critical_alerts": critical_alerts,
            "alert_domains": alert_domains,
            "watch_domains": watch_domains,
            "readiness_components": {"starting_score": 100, "penalties": penalties,
                                     "penalty_total": sum(p["penalty"] for p in penalties),
                                     "missing_data_cap_applied": len(missing) >= 1},
            "data_quality": {
                "domains_with_no_data": missing,
                "coverage_pct": round(100 * (total - len(missing)) / total, 1),
                "invalid_value_counts": invalid_values,
                "validation": validation,
                "warning": "Missing measurements reduce confidence; readiness is capped when coverage is incomplete."
                if missing else None,
            },
            "model_disclaimer": (
                "Prototype decision support only, using simulated/demo data. Vital thresholds, "
                "personal-baseline rules and countermeasures are not clinically validated. "
                "Bone and muscle forecasts use simulated labels." + metric_note +
                " This is not a diagnostic device."
            ),
            "model_provenance": {
                "muscle": {
                    "model_type": "GradientBoostingRegressor",
                    "training_data": "synthetic simulated exercise logs",
                    "validation": "held-out synthetic astronauts (GroupShuffleSplit)",
                    "metrics": self.muscle.metrics,
                    "limitations": "Synthetic labels only; no real astronaut or clinical validation.",
                },
                "bone": {
                    "model_type": "deterministic load-response model",
                    "training_data": "simulated exercise profiles",
                    "validation": "deterministic unit tests and simulated scenarios",
                    "limitations": "Not a measured bone-density forecast; no clinical validation.",
                },
            },
            "parameter_definitions": PARAMETER_DEFINITIONS,
            "domains": domains,
            "countermeasures": countermeasures,
            "countermeasure_summary": {
                "total": len(countermeasures),
                "completed": len(completed),
                "pending": len(countermeasures) - len(completed),
                "completion_pct": round(100 * len(completed) / len(countermeasures), 1)
                if countermeasures else 100.0,
            },
            "alerts": [f"[{k}] {a}" for k, d in domains.items() for a in d["alerts"]],
            "actions": [f"[{k}] {a}" for k, d in domains.items() for a in d["actions"]],
        }


# ----------------------------------------------------------------------------
# COUNTERMEASURES
# ----------------------------------------------------------------------------
COUNTERMEASURE_LIBRARY = {
    "blood_pressure": ("CM-BP", "Blood pressure review",
                       "Rest for five minutes and repeat the measurement; notify the medical chief if the reading persists."),
    "spo2": ("CM-SPO2", "Oxygen saturation check",
             "Verify sensor placement and cabin/suit oxygen supply; notify the medical chief if saturation remains low."),
    "body_temp": ("CM-TEMP", "Temperature review",
                  "Re-measure at rest, review cooling/thermal controls and report persistent fever to the medical chief."),
    "sleep": ("CM-SLEEP", "Sleep recovery",
              "Protect the next sleep window, reduce non-critical tasks and review the sleep timeline with the medical chief."),
    "stress": ("CM-STRESS", "Stress recovery",
               "Schedule a rest block and a private support conference; reduce non-critical workload."),
    "radiation": ("CM-RAD", "Radiation protection",
                  "Follow storm-shelter procedure, move to the most shielded area and review the exposure plan."),
    "muscle": ("CM-MUSCLE", "Muscle-loading countermeasure",
               "Complete or lengthen the prescribed resistance (ARED) session and review protein/calorie intake."),
    "bone": ("CM-BONE", "Bone-loading countermeasure",
             "Complete or lengthen the prescribed resistance (ARED) session and review calorie/vitamin D intake."),
    "hydration": ("CM-HYDRATION", "Hydration countermeasure",
                  "Increase water and electrolyte intake toward the daily target and review the fluid log."),
    "nutrition": ("CM-NUTRITION", "Nutrition countermeasure",
                  "Increase energy intake toward predicted expenditure and review the meal log."),
    "heart_rate": ("CM-HR", "Cardiac monitoring countermeasure",
                   "Stop exertion, re-measure after five minutes and review the cardiac trend with the medical chief."),
}


def build_countermeasures(domains: dict, completion: dict | None = None) -> list[dict]:
    """Build evidence-linked countermeasures for non-normal domains.

    ``completion`` may be keyed by domain name, countermeasure code or id. The
    engine never writes completion state itself; the existing Firestore
    ``countermeasureRecords`` collection remains the source of truth.
    """
    completion = completion or {}
    items = []
    for domain, result in domains.items():
        if result["status"] in ("NORMAL", "NO_DATA"):
            continue
        code, title, instruction = COUNTERMEASURE_LIBRARY[domain]
        key = domain
        done = bool(
            completion.get(key, completion.get(code, completion.get(f"CM-{domain.upper()}", False)))
        )
        items.append({
            "id": code.lower().replace("-", "_"),
            "code": code,
            "parameter": domain,
            "label": PARAMETER_DEFINITIONS[domain]["label"],
            "title": title,
            "instruction": instruction,
            "priority": "CRITICAL" if result["status"] == "ALERT" else "ROUTINE",
            "evidence": {
                "source": "AstroGuard prototype countermeasure rule set",
                "rule": PARAMETER_DEFINITIONS[domain]["source"],
                "note": "Operational prompt only; not a clinical prescription or NASA-validated protocol.",
            },
            "completionStatus": "COMPLETED" if done else "PENDING",
            "progress": 100 if done else 0,
        })
    return items


# ----------------------------------------------------------------------------
# SIMULATOR (for demos and tests) + CLI
# ----------------------------------------------------------------------------
SIM_PROFILES = ("healthy", "deteriorating", "sleep_deprived", "radiation_event", "hypoxia",
                "fever", "sedentary", "dehydration", "malnutrition", "tachycardia")


def simulate_mission(profile: str = "healthy", days: int = 120, seed: int = 0) -> pd.DataFrame:
    """Synthetic daily log. Baseline values are typical-healthy placeholders."""
    if profile not in SIM_PROFILES:
        raise ValueError(f"profile must be one of {SIM_PROFILES}")
    rng = np.random.default_rng(seed)
    ramp = np.linspace(0, 1, days)
    ex_scale = {"deteriorating": np.linspace(1.0, 0.15, days), "sedentary": np.full(days, 0.15)}.get(profile, np.ones(days))
    log = pd.DataFrame({
        "day": np.arange(1, days + 1),
        "resist_min": np.clip(rng.normal(45, 5, days) * ex_scale, 0, None),
        "tread_min": np.clip(rng.normal(35, 5, days) * ex_scale, 0, None),
        "cycle_min": np.clip(rng.normal(20, 5, days) * ex_scale, 0, None),
        "systolic": rng.normal(118, 4, days), "diastolic": rng.normal(74, 3, days),
        "spo2": np.clip(rng.normal(97.2, 0.5, days), 0, 100), "body_temp": rng.normal(36.7, 0.15, days),
        "sleep_hours": np.clip(rng.normal(7.0, 0.4, days), 3, 10),
        "resting_hr": rng.normal(62, 2, days), "hrv_ms": rng.normal(65, 4, days),
        "stress_self": np.clip(rng.normal(3, 0.6, days), 0, 10),
        "radiation_msv": np.clip(rng.normal(0.5, 0.04, days), 0.1, None),
        "water_l": np.clip(rng.normal(2.4, 0.2, days), 0.5, 5.0),
        "calories_kcal": np.clip(rng.normal(2400, 120, days), 800, 4000),
    })
    if profile == "deteriorating":
        log["systolic"] += 28 * ramp
        log["diastolic"] += 14 * ramp
        log["sleep_hours"] -= 1.8 * ramp
        log["resting_hr"] += 10 * ramp
        log["hrv_ms"] -= 25 * ramp
        log["stress_self"] += 4 * ramp
        log["water_l"] -= 0.8 * ramp
        log["calories_kcal"] -= 500 * ramp
    elif profile == "sleep_deprived":
        log.loc[days - 20:, "sleep_hours"] = rng.normal(4.6, 0.4, 20)
        log.loc[days - 20:, "stress_self"] += 3
    elif profile == "radiation_event":
        log.loc[days - 1, "radiation_msv"] = 6.0
        log.loc[days - 2, "radiation_msv"] = 3.2
    elif profile == "hypoxia":
        log.loc[days - 4:, "spo2"] = rng.normal(89.5, 0.6, 4)
    elif profile == "fever":
        log.loc[days - 3:, "body_temp"] = rng.normal(38.3, 0.1, 3)
    elif profile == "dehydration":
        log.loc[days - 10:, "water_l"] = rng.normal(0.9, 0.15, 10)
    elif profile == "malnutrition":
        log.loc[days - 14:, "calories_kcal"] = rng.normal(1250, 80, 14)
    elif profile == "tachycardia":
        log.loc[days - 4:, "resting_hr"] = rng.normal(132, 4, 4)
    return log


def _print_report(name, rep):
    print(f"\n=== {name}: {rep['condition']} (readiness {rep['readiness']}/100) ===")
    for k, d in rep["domains"].items():
        print(f"  {k:15s} {d['status']}")
    for a in rep["alerts"]:
        print("   !", a)


def _demo():
    monitor = AstronautHealthMonitor.load_or_train()
    reports = {p: monitor.analyze(simulate_mission(p, seed=3)) for p in SIM_PROFILES}
    for p, r in reports.items():
        _print_report(p, r)

    dom = lambda p, k: reports[p]["domains"][k]["status"]
    assert reports["healthy"]["condition"] == "FINE", "healthy astronaut should show FINE"
    assert all(d["status"] == "NORMAL" for d in reports["healthy"]["domains"].values()), "healthy should be all NORMAL"
    assert dom("sleep_deprived", "sleep") == "ALERT"
    assert dom("radiation_event", "radiation") == "ALERT"
    assert dom("hypoxia", "spo2") == "ALERT"
    assert dom("fever", "body_temp") == "ALERT"
    assert dom("dehydration", "hydration") == "ALERT"
    assert dom("malnutrition", "nutrition") == "ALERT"
    assert dom("tachycardia", "heart_rate") == "ALERT"
    for k in ("blood_pressure", "sleep", "stress", "muscle", "bone"):
        assert dom("deteriorating", k) != "NORMAL", f"deteriorating astronaut should flag {k}"
    for k in ("muscle", "bone"):
        assert dom("sedentary", k) != "NORMAL", f"sedentary astronaut should flag {k}"
    assert reports["deteriorating"]["condition"] == "DANGER"
    print("\nSanity checks passed.")


if __name__ == "__main__":
    if len(sys.argv) > 2 and sys.argv[1] == "--csv":
        import json
        out = AstronautHealthMonitor.load_or_train().analyze(pd.read_csv(sys.argv[2]))
        print(json.dumps(out, indent=2, default=str))
    else:
        _demo()
