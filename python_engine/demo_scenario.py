"""
demo_scenario.py - repeatable five-day hackathon mission scenario.

This writes ONLY local JSON; it never touches Firestore or user records.
All values are synthetic demonstration data.

Run:
    python -m python_engine.demo_scenario
    python -m python_engine.demo_scenario --out python_engine/demo_output
"""

from __future__ import annotations

import argparse
import json
import os
from typing import Any

import pandas as pd

try:  # package execution
    from .astronaut_health import AstronautHealthMonitor, simulate_mission
except ImportError:  # direct script execution
    from astronaut_health import AstronautHealthMonitor, simulate_mission


def _set_day(log: pd.DataFrame, index: int, **values: Any) -> None:
    for column, value in values.items():
        log.loc[index, column] = value


def build_scenario_logs(days: int = 14, seed: int = 42) -> list[dict[str, Any]]:
    """Return five cumulative daily logs (one per scenario day)."""
    base = simulate_mission("healthy", days=days, seed=seed)
    scenario_logs = [base.copy()]

    # DAY 1 - normal mission baseline
    day1 = base.copy()
    scenario_logs.append(day1)

    # DAY 2 - a four-day sleep restriction begins; stress and HR rise
    day2 = day1.copy()
    _set_day(day2, day2.index[-7:], sleep_hours=5.2, stress_self=6.8,
             resting_hr=80, hrv_ms=46)
    scenario_logs.append(day2)

    # DAY 3 - reduced oxygen saturation plus cardiac compensation
    day3 = day2.copy()
    _set_day(day3, day3.index[-3:], spo2=93.0, resting_hr=98, hrv_ms=42,
             body_temp=37.4, sleep_hours=5.0, stress_self=7.2)
    scenario_logs.append(day3)

    # DAY 4 - multiple warnings and a DANGER state
    day4 = day3.copy()
    _set_day(day4, day4.index[-4:], spo2=89.0, systolic=146, diastolic=92,
             body_temp=38.1, sleep_hours=4.4, stress_self=8.5,
             resting_hr=128, hrv_ms=31, water_l=1.0, calories_kcal=1350)
    _set_day(day4, day4.index[-1], radiation_msv=2.8)
    scenario_logs.append(day4)

    # DAY 5 - countermeasures completed; selected physiological inputs return
    # toward baseline. This is NOT an instantaneous recovery model: bone and
    # muscle forecasts remain chronic/long-horizon estimates and are not
    # "healed" by changing one day of telemetry.
    day5 = day4.copy()
    _set_day(day5, day5.index[-5:], spo2=97.0, systolic=120, diastolic=76,
             body_temp=36.8, resting_hr=70, hrv_ms=62, stress_self=3.5,
             water_l=2.35, calories_kcal=2350)
    _set_day(day5, day5.index[-7:], sleep_hours=6.9)
    _set_day(day5, day5.index[-2:], radiation_msv=0.55)
    scenario_logs.append(day5)

    return [frame.to_dict(orient="records") for frame in scenario_logs[1:]]


def run_scenario(seed: int = 42) -> dict[str, Any]:
    monitor = AstronautHealthMonitor.load_or_train()
    logs = build_scenario_logs(seed=seed)
    completion_by_day = [
        {},
        {},
        {"sleep": True, "hydration": True},
        {"sleep": True, "hydration": True, "nutrition": True},
        {"sleep": True, "hydration": True, "nutrition": True, "stress": True,
         "heart_rate": True, "blood_pressure": True, "spo2": True, "body_temp": True},
    ]
    scenario = []
    for index, (records, completion) in enumerate(zip(logs, completion_by_day), start=1):
        report = monitor.analyze(
            pd.DataFrame(records), countermeasure_status=completion
        )
        scenario.append({
            "day": index,
            "is_simulated": True,
            "condition": report["condition"],
            "readiness": report["readiness"],
            "reason": report["condition_reason"],
            "domain_statuses": {key: value["status"] for key, value in report["domains"].items()},
            "alerts": report["alerts"],
            "countermeasures": report["countermeasures"],
            "countermeasure_summary": report["countermeasure_summary"],
            "report": report,
        })
    return {
        "scenario": "ASTROGUARD FIVE-DAY SIMULATED MISSION",
        "is_simulated": True,
        "disclaimer": (
            "Synthetic demonstration data only. Not real astronaut records, "
            "not a diagnosis and not NASA-validated."
        ),
        "recovery_note": (
            "Day 5 changes selected physiological inputs to demonstrate triage "
            "recovery. It does not model instant bone or muscle recovery; those "
            "remain long-horizon, simulated forecasts."
        ),
        "seed": seed,
        "days": scenario,
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--out", default="", help="Optional directory for JSON output.")
    parser.add_argument("--seed", type=int, default=42)
    args = parser.parse_args()
    result = run_scenario(seed=args.seed)
    payload = json.dumps(result, indent=2, default=str)
    if args.out:
        os.makedirs(args.out, exist_ok=True)
        path = os.path.join(args.out, "five_day_mission.json")
        with open(path, "w", encoding="utf-8") as handle:
            handle.write(payload + "\n")
        print(f"Wrote {path}")
    else:
        print(payload)


if __name__ == "__main__":
    main()
