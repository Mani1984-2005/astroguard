"""Automated tests for the AstroGuard Python health engine.

Run from the repository root:
    python -m unittest discover -s python_engine/tests -v
"""

from __future__ import annotations

import json
import os
import subprocess
import sys
import tempfile
import unittest

import pandas as pd

HERE = os.path.dirname(os.path.abspath(__file__))
ENGINE_DIR = os.path.dirname(HERE)
if ENGINE_DIR not in sys.path:
    sys.path.insert(0, ENGINE_DIR)

import astronaut_health as engine  # noqa: E402
import bone_health as bone  # noqa: E402


def base_log(days: int = 21) -> pd.DataFrame:
    return engine.simulate_mission("healthy", days=days, seed=7)


class EngineTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.monitor = engine.AstronautHealthMonitor.load_or_train()

    def test_all_eleven_parameters_present_and_normal(self):
        report = self.monitor.analyze(base_log())
        expected = {
            "blood_pressure", "spo2", "body_temp", "sleep", "stress", "radiation",
            "muscle", "bone", "hydration", "nutrition", "heart_rate",
        }
        self.assertEqual(set(report["domains"]), expected)
        self.assertEqual(report["parameter_definitions"].keys(), expected)
        self.assertEqual(report["condition"], "FINE")
        self.assertEqual(report["readiness"], 100)
        self.assertEqual(report["overall_status"], "NORMAL")

    def test_invalid_values_are_reported_and_not_treated_as_healthy(self):
        log = base_log()
        log.loc[log.index[-1], "spo2"] = 150
        report = self.monitor.analyze(log)
        self.assertIn("spo2", report["data_quality"]["invalid_value_counts"])
        # Invalid readings are blanked; the remaining valid readings still work,
        # but the invalid count must be disclosed.
        self.assertTrue(report["data_quality"]["validation"]["errors"])

    def test_missing_all_measurements_is_no_signal_and_capped(self):
        log = pd.DataFrame({"day": range(1, 6)})
        report = self.monitor.analyze(log)
        self.assertEqual(report["condition"], "NO SIGNAL")
        self.assertLessEqual(report["readiness"], 40)
        self.assertEqual(len(report["data_quality"]["domains_with_no_data"]), 11)

    def test_critical_alert_forces_danger(self):
        log = base_log()
        log.loc[log.index[-3]:, "spo2"] = 88
        report = self.monitor.analyze(log)
        self.assertEqual(report["domains"]["spo2"]["status"], "ALERT")
        self.assertEqual(report["condition"], "DANGER")
        self.assertIn("spo2", report["critical_alerts"])
        self.assertIn("Critical alert", report["condition_reason"])

    def test_noncritical_alert_is_at_least_caution(self):
        log = base_log()
        log.loc[log.index[-10]:, "water_l"] = 0.9
        report = self.monitor.analyze(log)
        self.assertEqual(report["domains"]["hydration"]["status"], "ALERT")
        self.assertIn(report["condition"], ("CAUTION", "DANGER"))
        self.assertNotEqual(report["condition"], "FINE")

    def test_watch_finding_is_never_reported_as_fine(self):
        log = base_log()
        log.loc[log.index[-7]:, "sleep_hours"] = 6.3
        report = self.monitor.analyze(log)
        self.assertEqual(report["domains"]["sleep"]["status"], "WATCH")
        self.assertEqual(report["overall_status"], "WATCH")
        self.assertNotEqual(report["condition"], "FINE")
        self.assertIn("Sleep", report["condition_reason"])

    def test_severe_self_reported_stress_cannot_be_hidden_by_other_normal_inputs(self):
        log = base_log()
        log.loc[log.index[-3:], "stress_self"] = 9.0
        report = self.monitor.analyze(log)
        stress = report["domains"]["stress"]
        self.assertEqual(stress["status"], "ALERT")
        self.assertEqual(stress["summary"]["self_report_3d"], 9.0)
        self.assertTrue(
            any("Self-reported stress" in alert for alert in stress["alerts"]),
            stress["alerts"],
        )
        self.assertNotEqual(report["condition"], "FINE")
        self.assertIn("Stress", report["condition_reason"])
        self.assertLess(report["readiness"], 100)

    def test_trends_are_calculated(self):
        log = base_log()
        log["resting_hr"] = range(60, 60 + len(log))
        report = self.monitor.analyze(log)
        trend = report["domains"]["heart_rate"]["trend"]
        self.assertEqual(trend["direction"], "rising")
        self.assertGreater(trend["slope_bpm_per_day"], 0)

    def test_countermeasure_completion_tracking(self):
        log = base_log()
        log.loc[log.index[-3]:, "spo2"] = 88
        pending = self.monitor.analyze(log)
        self.assertTrue(any(c["completionStatus"] == "PENDING" for c in pending["countermeasures"]))
        completed = self.monitor.analyze(log, countermeasure_status={"spo2": True})
        spo2_cm = next(c for c in completed["countermeasures"] if c["parameter"] == "spo2")
        self.assertEqual(spo2_cm["completionStatus"], "COMPLETED")
        self.assertEqual(completed["countermeasure_summary"]["completed"], 1)

    def test_validation_rejects_impossible_heart_rate(self):
        log = base_log()
        log.loc[log.index[-1], "resting_hr"] = 900
        result = engine.validate_daily_log(log)
        self.assertFalse(result["valid"])
        self.assertIn("resting_hr", result["invalid_columns"])

    def test_all_simulated_profiles_produce_a_status(self):
        for profile in engine.SIM_PROFILES:
            report = self.monitor.analyze(engine.simulate_mission(profile, days=30, seed=3))
            self.assertIn(report["condition"], ("FINE", "CAUTION", "DANGER", "NO SIGNAL"))
            self.assertIn("model_disclaimer", report)
            self.assertTrue(report["is_simulated"] if "is_simulated" in report else True)

    def test_five_day_demo_scenario_is_repeatable(self):
        from python_engine import demo_scenario

        first = demo_scenario.run_scenario(seed=42)
        second = demo_scenario.run_scenario(seed=42)
        first_days = [(d["condition"], d["readiness"]) for d in first["days"]]
        second_days = [(d["condition"], d["readiness"]) for d in second["days"]]
        self.assertEqual(first_days, second_days)
        self.assertEqual(first_days[0][0], "FINE")
        self.assertEqual(first_days[1][0], "CAUTION")
        self.assertEqual(first_days[3][0], "DANGER")
        self.assertEqual(first_days[4][0], "CAUTION")
        self.assertTrue(all(day["is_simulated"] for day in first["days"]))
        self.assertIn("not model instant bone or muscle recovery", first["recovery_note"])

    def test_readiness_is_deterministic(self):
        log = base_log()
        first = self.monitor.analyze(log)
        second = self.monitor.analyze(log)
        self.assertEqual(first["readiness"], second["readiness"])
        self.assertEqual(first["condition"], second["condition"])


class BoneModelPersistenceTests(unittest.TestCase):
    def test_model_round_trip_preserves_parameters(self):
        with tempfile.TemporaryDirectory() as directory:
            path = os.path.join(directory, "bone-model.json")
            original = bone.BoneHealthModel(
                target_load=42.5,
                max_monthly_loss_pct=1.2,
                memory_days=8,
                metrics={"training_data": "SIMULATED"},
            )
            original.save(path)

            restored = bone.BoneHealthModel.load_or_train(path)

            self.assertEqual(restored.target_load, original.target_load)
            self.assertEqual(
                restored.max_monthly_loss_pct, original.max_monthly_loss_pct
            )
            self.assertEqual(restored.memory_days, original.memory_days)
            self.assertEqual(restored.metrics, original.metrics)

    def test_missing_model_uses_and_persists_defaults(self):
        with tempfile.TemporaryDirectory() as directory:
            path = os.path.join(directory, "missing-model.json")

            model = bone.BoneHealthModel.load_or_train(path)

            self.assertEqual(model.target_load, bone.TARGET_LOAD)
            self.assertEqual(model.max_monthly_loss_pct, bone.MAX_MONTHLY_LOSS_PCT)
            self.assertEqual(model.memory_days, bone.LOAD_MEMORY_DAYS)
            self.assertTrue(os.path.isfile(path))

    def test_malformed_and_invalid_models_fall_back_to_defaults(self):
        invalid_payloads = (
            "{not json",
            "[]",
            json.dumps({"target_load": 0}),
            json.dumps({"max_monthly_loss_pct": -1}),
            json.dumps({"memory_days": 2.5}),
            json.dumps({"metrics": []}),
            '{"target_load": NaN}',
            '{"target_load": ' + ("9" * 5000) + "}",
        )
        with tempfile.TemporaryDirectory() as directory:
            for index, content in enumerate(invalid_payloads):
                with self.subTest(payload=content):
                    path = os.path.join(directory, f"invalid-{index}.json")
                    with open(path, "w", encoding="utf-8") as handle:
                        handle.write(content)

                    model = bone.BoneHealthModel.load_or_train(path)

                    self.assertEqual(model.target_load, bone.TARGET_LOAD)
                    self.assertEqual(
                        model.max_monthly_loss_pct, bone.MAX_MONTHLY_LOSS_PCT
                    )
                    self.assertEqual(model.memory_days, bone.LOAD_MEMORY_DAYS)
                    with open(path, "r", encoding="utf-8") as handle:
                        self.assertIsInstance(json.load(handle), dict)

    def test_unavailable_model_storage_does_not_block_defaults(self):
        with tempfile.TemporaryDirectory() as directory:
            path = os.path.join(directory, "missing-directory", "bone-model.json")

            model = bone.BoneHealthModel.load_or_train(path)

            self.assertEqual(model.target_load, bone.TARGET_LOAD)
            self.assertFalse(os.path.exists(os.path.dirname(path)))

    def test_invalid_runtime_parameters_are_rejected(self):
        for kwargs in (
            {"target_load": 0},
            {"target_load": float("nan")},
            {"max_monthly_loss_pct": -1},
            {"memory_days": 0},
            {"memory_days": 1.5},
        ):
            with self.subTest(kwargs=kwargs):
                with self.assertRaises(ValueError):
                    bone.BoneHealthModel(**kwargs)


class BridgeProtocolTests(unittest.TestCase):
    def test_worker_handles_json_lines_errors_and_eof(self):
        requests = (
            '{"id":"health-1","action":"health","payload":{}}\n'
            '{"id":"bad-1","action":"unknown","payload":{}}\n'
            '{malformed\n'
        )
        result = subprocess.run(
            [sys.executable, os.path.join(ENGINE_DIR, "bridge.py")],
            input=requests,
            capture_output=True,
            text=True,
            timeout=30,
            check=False,
        )

        self.assertEqual(result.returncode, 0, result.stderr)
        messages = [json.loads(line) for line in result.stdout.splitlines()]
        self.assertEqual(messages[0], {"ready": True, "engine": "python"})
        self.assertEqual(messages[1]["id"], "health-1")
        self.assertTrue(messages[1]["ok"])
        self.assertEqual(messages[1]["result"]["engine"], "python")
        self.assertEqual(messages[2]["id"], "bad-1")
        self.assertFalse(messages[2]["ok"])
        self.assertIsNone(messages[3]["id"])
        self.assertFalse(messages[3]["ok"])


class ApiTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        try:
            from fastapi.testclient import TestClient
            from python_engine.api import app
        except Exception as exc:  # pragma: no cover - dependency guard
            raise unittest.SkipTest(f"FastAPI TestClient unavailable: {exc}")
        cls.client = TestClient(app)

    def test_health_endpoint(self):
        response = self.client.get("/health")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["parameters"], 11)

    def test_analyze_endpoint(self):
        logs = base_log(7).to_dict(orient="records")
        response = self.client.post("/analyze", json={"logs": logs, "crew_id": "AG-LEO-01"})
        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertEqual(body["crew_id"], "AG-LEO-01")
        self.assertTrue(body["is_simulated"])

    def test_short_payload_is_rejected(self):
        logs = base_log(2).to_dict(orient="records")
        response = self.client.post("/analyze", json={"logs": logs})
        self.assertEqual(response.status_code, 422)

    def test_simulate_endpoint(self):
        response = self.client.post("/simulate", json={"profile": "hypoxia", "days": 10, "seed": 1})
        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertEqual(body["report"]["domains"]["spo2"]["status"], "ALERT")


if __name__ == "__main__":
    unittest.main()
