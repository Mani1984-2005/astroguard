# AstroGuard Python Health Engine

Prototype, deterministic health-monitoring and readiness engine for the
AstroGuard demonstration application. It consumes a daily astronaut log and
returns per-parameter status, trends, alerts, evidence-linked countermeasures,
completion tracking, and combined readiness.

> **Important:** this is not a diagnostic medical device. Thresholds, composite
> weights, and bone/muscle forecasts are engineering placeholders or models
> calibrated on **simulated** data. Nothing here is NASA-certified or a
> validated clinical rule. Do not use it for real medical decisions.

## 1. Monitored parameters (11)

| Domain | Input columns | Unit | Prototype rule source |
|---|---|---|---|
| Blood pressure | `systolic`, `diastolic` | mmHg | Clinical-style placeholders; confirm with a clinician |
| SpO2 | `spo2` | % | Prototype pulse-oximetry cut-offs |
| Body temperature | `body_temp` | °C | Prototype temperature cut-offs |
| Sleep | `sleep_hours` | h/day | Prototype duration/regularity targets |
| Stress | `sleep_hours`, `resting_hr`, `hrv_ms`, `stress_self`, `systolic` | index 0–100 | Transparent weighted composite; weights are assumptions |
| Radiation | `radiation_msv` (+ `prior_career_msv`) | mSv/day | Dose accounting vs. 600 mSv career reference + spike detector |
| Muscle loss | `resist_min`, `tread_min`, `cycle_min` | minutes/day | Model trained on simulated labels |
| Bone loss | `resist_min`, `tread_min`, `cycle_min` | minutes/day | Deterministic load-response model calibrated on simulated data |
| Hydration | `water_l` or `hydration` | L/day | Prototype operational target (2.4 L/day) |
| Nutrition | `calories_kcal` or `nutrition` | kcal/day | Prototype energy target (2400 kcal/day) |
| Heart rate | `heart_rate` or `resting_hr` | BPM | Prototype resting bounds; exertion artefacts must be excluded |

Every column is optional. A domain with no usable recent data returns
`NO_DATA`; missing data is never treated as healthy.

## 2. Environment and installation

Python 3.11+ is recommended.

```powershell
cd E:\astroguard
python -m pip install -r python_engine/requirements.txt
```

The first analysis trains and caches `muscle_model.joblib`; later calls load the
cached model. `bone_model.json` stores the deterministic bone-model constants.
Both are generated artefacts, not clinical models.

## 3. Running the engine

### JSON-lines bridge (used by Express)

```powershell
python python_engine/bridge.py
```

Send one JSON object per line:

```json
{"id":"1","action":"health","payload":{}}
{"id":"2","action":"analyze","payload":{"logs":[...],"priorCareerMsv":0}}
```

Actions: `health`, `parameters`, `validate`, `analyze`, `simulate`.

### FastAPI service (local development only)

```powershell
python -m uvicorn python_engine.api:app --host 127.0.0.1 --port 8001
```

Endpoints:

- `GET /health`
- `GET /parameters`
- `POST /validate` — `{ "logs": [...] }`
- `POST /analyze` — `{ "logs": [...], "prior_career_msv": 0, "countermeasure_status": {} }`
- `POST /simulate` — `{ "profile": "hypoxia", "days": 10, "seed": 1 }`

The FastAPI service performs **no authentication**. It must remain bound to
loopback and reached through the Express API. Do not expose port 8001 publicly.

### Demo

```powershell
python -m python_engine.demo_scenario --out python_engine/demo_output
```

This writes a repeatable five-day synthetic mission to
`python_engine/demo_output/five_day_mission.json`. It never writes Firestore.
The seeded run transitions through `FINE -> CAUTION -> CAUTION -> DANGER ->
CAUTION`. Day 5 is a selected-parameter triage recovery; it does **not** model
instant bone or muscle recovery, and those forecasts remain long-horizon and
simulated.

## 4. API integration and authorization

Express exposes the only public health endpoints:

- `GET /api/health/parameters` — authenticated crew or chief
- `POST /api/health/analyze` — authenticated crew or chief
- `GET /api/health/engine-status` — **Medical Chief only**
- `POST /api/health/simulate` — **Medical Chief only**

Authorization accepts:

1. the signed HttpOnly Medical Chief session cookie,
2. the signed HttpOnly simulation-crew session cookie, or
3. a Firebase ID token bearer whose server-read Firestore profile is active.

Astronauts may analyze only their own `crewId`; a cross-crew request is denied
and audited server-side. Frontend checks are never the authorization boundary.
The Python process itself does not write Firestore.

## 5. Readiness calculation

The score is deterministic:

1. Start at **100**.
2. Subtract **6** points per `WATCH` domain.
3. Subtract **15** points per `ALERT` domain.
4. Clamp at 0.
5. Cap at **70** when any domain has `NO_DATA`; cap at **40** when 4+ domains
   have no data.
6. Conditions: `FINE >= 80`, `CAUTION 50–79`, `DANGER < 50`, plus:
   - any critical-domain `ALERT` (`blood_pressure`, `spo2`, `body_temp`,
     `heart_rate`, `radiation`) forces `DANGER`;
   - any non-critical `ALERT` forces at least `CAUTION`;
   - any `WATCH` domain also prevents `FINE`; a report with a WATCH finding is
     at least `CAUTION`;
   - missing data cannot produce `FINE`;
   - 4+ missing domains with no alert produces `NO SIGNAL`.

The report includes `readiness_components.penalties` and
`contributing_parameters` so the score can be explained.

## 6. Countermeasures and completion

Countermeasures are generated only for `WATCH`/`ALERT` domains. Each item has a
code, instruction, priority, evidence note, and `PENDING`/`COMPLETED` status.
Completion is supplied by the caller from the existing Firestore
`countermeasureRecords` collection; the Python engine does not persist state.

## 7. Validation and data quality

`validate_daily_log` reports missing/non-numeric values and physically
implausible values (for example SpO2 outside 50–100 or heart rate outside
20–300 BPM). Implausible values are blanked before analysis and listed in
`data_quality.invalid_value_counts`. These are data-quality guards, not
diagnostic thresholds.

## 8. Testing

```powershell
python -m py_compile python_engine/astronaut_health.py python_engine/bone_health.py python_engine/api.py python_engine/bridge.py python_engine/demo_scenario.py
python -m unittest discover -s python_engine/tests -v
```

The suite covers valid/invalid/missing measurements, all 11 domains, critical
and non-critical alerts, severe self-reported stress escalation, readiness
determinism, trends, countermeasure completion, persistence, and FastAPI
success/failure responses.

## 9. Known limitations

- Thresholds and weights are prototype placeholders, not clinical guidance.
- Bone and muscle models use simulated calibration; no DXA or MRI validation.
- The muscle model's held-out synthetic metrics are next-30-day MAE `0.198%`
  (mean-prediction baseline `1.005%`) and R² `0.911`; cumulative MAE is
  `0.584%` and R² `0.923`. These are simulated-label diagnostics only.
- Radiation accounting uses a simplified 600 mSv career reference. It is not a
  live NASA flight rule or a substitute for current NASA radiation-protection
  standards; verify the applicable limit before operational use.
- Stress is a heuristic composite, not a validated psychological instrument.
- The frontend maps interval telemetry into a simulated daily log and places
  snapshot-only values on the latest row. The UI does not provide exercise
  history, so Python muscle and bone domains report `NO_DATA` for that input
  instead of deriving exercise minutes.
- Firebase Admin credentials are required for Firebase-bearer API access. A
  bearer token must also have a verified email and an active Firestore profile.
  Without Admin credentials, signed simulation/chief cookies still work and the
  TypeScript engine remains the fallback. Live bearer authentication was not
  exercised in this environment.
- The system is a demonstration and has not undergone clinical validation,
  regulatory review, or NASA certification.
