# Five-Day Mission Demonstration

This is a repeatable synthetic rehearsal for the Python readiness engine. It is
not a real astronaut mission, not a clinical trial, and not a prediction of
individual crew health.

## 1. Generate the scenario

From `E:\astroguard`:

```powershell
npm run demo:scenario
```

The command writes:

```text
python_engine/demo_output/five_day_mission.json
```

It does not write Firestore or call the Express API. Each day is a cumulative
synthetic log, and every day is marked as simulated in the output metadata.

## 2. Expected transitions

The seeded run produces:

| Day | Readiness | Condition | Interpretation |
|---|---:|---|---|
| Day 1 | 100 | `FINE` | Baseline simulated crew state |
| Day 2 | 64 | `CAUTION` | Sleep and hydration load accumulate |
| Day 3 | 52 | `CAUTION` | Multi-domain strain continues |
| Day 4 | 0 | `DANGER` | Critical simulated excursion |
| Day 5 | 94 | `CAUTION` | Selected parameters improve, but one WATCH domain remains |

Day 5 is intentionally **`CAUTION`, not `FINE`**. A WATCH finding prevents a
FINE result. The improvement reflects triage and countermeasure response in the
selected parameters; it does **not** model instant bone or muscle recovery.
Bone and muscle forecasts remain long-horizon, simulated models.

## 3. Live UI demonstration

1. Start the app with `npm run dev`.
2. Open `http://127.0.0.1:3102`.
3. Enter the Medical Chief portal and sign in with the locally provisioned
   Medical Chief credential.
4. Use the **LOCAL DEMO READY** four-crew workspace when Firebase Admin is not
   configured. This is in-memory data for the current signed-in session.
5. Show the roster: full names, crew IDs, roles, and flight-day information.
6. Open **Simulation Controls**. The four scenarios are:
   - Level 1 SAFE
   - Level 2 CAUTION
   - Level 3 DANGER
   - Fail-safe Missing Sensor Data
7. Select **DANGER** for the selected crew. The roster, alert dock, emergency
   modal, and Python readiness panel should all reflect the critical state.
8. Open **My Health** to show the same critical state and Python readiness
   report.
9. Return to the Medical Chief workspace and use **Reset Local 4-Crew Demo
   Scenario** to restore the baseline roster and alerts for the session.
10. For the astronaut view, sign out, choose a fictional crew member, and repeat
    the DANGER scenario. Crew sessions cannot call the Medical Chief simulate
    endpoint; the simulation is isolated to the in-memory demo state.

## 4. What to say during the demo

- The TypeScript engine provides the immediate synchronous evaluation.
- The Python engine is an additive readiness layer and returns the explainable
  eleven-domain report when the bridge is available.
- The alerts and readiness are demonstration logic, not clinical guidance.
- Missing sensor data is shown as missing or `NO SIGNAL`; it is not treated as
  healthy.
- The five-day run demonstrates deterioration, a critical excursion, and a
  partial recovery with a persisting WATCH finding.

## 5. Reset and repeatability

The scenario is deterministic for the seeded inputs. Re-running
`npm run demo:scenario` overwrites the output file with the same seeded
transition sequence. The local UI reset restores the four-crew demo roster and
alerts for the current signed-in session; it does not modify Firestore.
