# AstroGuard Architecture

## 1. System shape

AstroGuard is a single-page React application served by an Express process. The
same Express process is the only public API boundary for health data and starts
the Python health engine on demand.

```text
Browser
  |  same-origin HTTP(S) cookies or Firebase ID token
  v
Express server (server.ts)
  |-- /api/auth/*           session and role establishment
  |-- /api/health/*         authenticated health proxy
  |-- /api/orbital-assets   public asset manifest
  |
  |-- Firebase Admin SDK    optional bearer-token verification
  |-- Firestore client      browser reads/writes under firestore.rules
  |
  v
Python bridge (python_engine/bridge.py)
  |-- astronaut_health.py   11-domain evaluation and readiness
  |-- bone_health.py        simulated long-horizon bone estimate
  |-- api.py                optional loopback-only FastAPI wrapper
```

The Python process is local and loopback-only. It does not write Firestore and
is not exposed as a public port. The Python source tree is not served by the web
server.

## 2. Frontend

Key frontend areas:

- `src/App.tsx` - session restoration, role-aware navigation, simulation
  controls, local demo state, Python report effect.
- `src/pages/MedicalChiefWorkspace.tsx` - crew roster, alerts, dataset state,
  local reset, crew-specific simulation.
- `src/pages/MyHealth.tsx` - astronaut health, Python readiness panel, alerts.
- `src/engine/healthEvaluationEngine.ts` - synchronous TypeScript fallback and
  scenario presets.
- `src/services/pythonHealthService.ts` - derives a simulated daily log from
  interval telemetry and calls `/api/health/analyze`.
- `src/services/astroguardDb.ts` - Firestore-backed repository operations.

The frontend is the presentation and fallback layer. It is not the
authorization boundary; Express enforces access to the health API.

## 3. Identities and authorization

Express accepts three actor sources:

1. **Signed Medical Chief cookie** - HttpOnly, with `SameSite` controlled and
   `Secure`/`Partitioned` added on HTTPS. The session payload is signed and
   checked server-side.
2. **Signed simulation-crew cookie** - HttpOnly, scoped to one of the fictional
   crew IDs, with a session ID and expiry. This is a demonstration identity, not
   a production astronaut login.
3. **Firebase ID token bearer** - verified with Firebase Admin. The token must
   have `email_verified === true`; the server then reads the Firestore user
   profile and requires an active account with a valid role and crew ID.

The Medical Chief password path is rate-limited and uses a scrypt hash stored in
the local server-side auth store. The password itself is not stored in the
repository.

### Role boundaries

| Role | Allowed health operations |
|---|---|
| `ASTRONAUT` | `POST /api/health/analyze` for its own `crewId` only; read parameters |
| `MEDICAL_CHIEF` | analyze/simulate for any crew; inspect crew roster and engine status |
| Simulation crew | isolated in-memory demo state for one fictional crew |
| Local demo chief | in-memory roster and alerts; no Firestore writes |

A cross-crew `analyze` request is rejected with `403` and audited. Crew sessions
cannot call `/api/health/simulate`; it is Medical Chief-only. Invalid simulation
profiles are rejected before a report is returned.

## 4. Processing flow

### Astronaut or Medical Chief analysis

1. Browser builds a simulated seven-row daily log from the current telemetry
   series. Missing channels remain `null`; exercise minutes are prescribed demo
   values.
2. Browser sends `POST /api/health/analyze` with the crew ID and log.
3. Express verifies the cookie or Firebase bearer and checks the actor's
   crew/role scope.
4. Express writes one JSON line to the Python bridge and awaits the response.
5. Python returns per-domain status, readiness, alerts, countermeasures, and
   evidence notes.
6. Express returns the report. The UI labels it as simulated and keeps the
   TypeScript evaluation as a synchronous fallback if the bridge is unavailable.

### Five-day rehearsal

`python -m python_engine.demo_scenario` builds five cumulative synthetic logs
and writes `python_engine/demo_output/five_day_mission.json`. It does not touch
Firestore.

## 5. Readiness methodology

The Python engine starts at 100 and subtracts:

- 6 per `WATCH` domain;
- 15 per `ALERT` domain;
- clamps at 0;
- caps at 70 when any domain has no usable data;
- caps at 40 when four or more domains have no usable data.

Condition bands are `FINE >= 80`, `CAUTION 50-79`, and `DANGER < 50`, with
safety overrides:

- a critical-domain `ALERT` (`blood_pressure`, `spo2`, `body_temp`,
  `heart_rate`, `radiation`) forces `DANGER`;
- any non-critical `ALERT` forces at least `CAUTION`;
- any `WATCH` also prevents `FINE`, so a WATCH report is at least `CAUTION`;
- missing data cannot produce `FINE`;
- four or more missing domains with no alert produces `NO SIGNAL`.

The report includes penalty components and contributing parameters so the score
is explainable.

## 6. Data model and Firestore

The Firestore blueprint and rules define these collections:

- `users` - role and crew binding;
- `provisionedAccounts` - Medical Chief-authorized onboarding bindings;
- `crew` - crew profile and mission metadata;
- `healthRecords/{crewId}` with `history` and `assessments` subcollections;
- `alerts`;
- `countermeasureRecords`;
- `surgeonNotes`;
- `evaluationConfig`;
- `auditLogs`.

`firestore.rules` denies access by default, then permits scoped reads/writes by
active, verified role holders. Astronauts can access only their own crew
records; Medical Chief access is role-checked. The rules file is the source of
truth for browser-side Firestore access and was not modified in this QA pass.

The local demo workspace bypasses Firestore intentionally. It is labelled
`LOCAL DEMO READY` and does not claim a Firestore write. Firebase-backed sessions
show `FIRESTORE DATA LOADED` only when the roster was loaded from Firestore.

## 7. Security controls in the Express boundary

- JSON body limit: 128 kB.
- Static/server path blocks for `server-data`, `.astroguard-server`, `scripts`,
  `python_engine`, `.env`, `server.ts`, `firestore.rules`, and blueprint files.
- HttpOnly session cookies; HTTPS adds `Secure` and `Partitioned`.
- Signed sessions and expiry checks.
- Medical Chief login rate limiting.
- Role and crew checks on every health route.
- Firebase bearer verification requires a verified email.
- Server-side audit logging for denied or privileged actions where implemented.
- Python source is not served; direct `/python_engine/*` requests return 404.

## 8. Known architectural limits

- The simulated crew portal intentionally allows fictional profile selection
  without email. This is a demo-only identity path.
- The Python service has no authentication of its own; it must stay bound to
  loopback and behind Express.
- The app is a demonstration, not a production clinical system. There is no
  clinical validation, regulatory review, or high-availability deployment.
- Live Firebase bearer verification was not exercised in this environment
  because Firebase Admin service-account credentials were unavailable.
