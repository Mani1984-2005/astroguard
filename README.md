# AstroGuard

AstroGuard is a hackathon demonstration of an orbital crew biomedical telemetry
and readiness dashboard. It combines a React/Vite frontend, an Express
authorization boundary, an optional Firebase/Firestore data path, and a Python
FastAPI/JSON-lines health engine.

> **Demonstration only.** All crew profiles, vitals, scenarios, alerts, and
> forecasts are simulated. AstroGuard is not a diagnostic medical device, is not
> clinically validated, and is not NASA-certified or NASA-endorsed. Do not use it
> for real medical or flight decisions.

## What is included

- Astronaut and Medical Chief portals with role-separated navigation.
- Four fictional crew profiles, isolated per crew.
- Eleven-domain Python health engine with deterministic readiness scoring.
- TypeScript fallback evaluation for the synchronous UI state.
- Triaged alerts, countermeasures, health history, and research context.
- Reproducible five-day mission scenario.
- Local demo mode for the Medical Chief when Firebase Admin is unavailable.

## Quick start

**Prerequisites:** Node.js 20+ and Python 3.11+. This QA pass ran on Node
24.17.0 and Python 3.11.9; other versions were not tested.

```powershell
cd E:\astroguard
npm install
python -m pip install -r python_engine/requirements.txt
npm run dev
```

Open <http://127.0.0.1:3000> (or the value of `PORT` if you override it).

The Express server starts the Python bridge on demand. The Python service is not
publicly exposed; all browser health calls pass through the authenticated
`/api/health/*` routes on the Express server.

Express does not trust forwarded headers by default. If deploying behind a
reverse proxy, set `TRUST_PROXY` to the exact trusted proxy hop count or to
comma-separated trusted proxy IP/CIDR values so client IP and HTTPS cookie
handling use only the configured proxy chain.

## Medical Chief access

Provision the Medical Chief password hash without putting a password in the
repository:

```powershell
npx tsx scripts/provision-medical-chief.ts --stdin
```

That command reads the password from standard input and writes the local
server-side auth store at `server-data/medical-chief-auth.json`. It does not
print the password or hash. Do not commit generated auth files or passwords.
Alternatively, set a scrypt `MEDICAL_CHIEF_PASSWORD_HASH` in the server
environment and let the server use the `ENV_HASH` auth source.

For a local demonstration without Firebase Admin credentials, use the Medical
Chief login and select the built-in **LOCAL DEMO READY** 4-crew workspace. This
data is held in memory for that signed-in session and is not written to
Firestore.

## Verification

```powershell
npm run lint
npm run build
npm run test:python
npm run demo:scenario
npm audit --omit=dev
```

The Python suite covers all eleven domains, invalid and missing measurements,
critical-alert forcing, WATCH-to-CAUTION behavior, repeatability, countermeasure
completion, and FastAPI success/failure responses.

## Documentation

- [Architecture and authorization boundaries](docs/ARCHITECTURE.md)
- [Five-day demonstration script](docs/FIVE_DAY_DEMO.md)
- [Limitations, simulated data, and verified references](docs/LIMITATIONS_AND_REFERENCES.md)
- [Backup and recovery](docs/BACKUP_AND_RECOVERY.md)
- [Python engine details](python_engine/README.md)

## Data and safety boundaries

- Simulated telemetry is labelled throughout the UI.
- The frontend maps interval telemetry into a seven-row demonstration log.
  Snapshot-only values appear on the latest row, and unavailable exercise
  history remains missing rather than being presented as observed activity.
- Missing sensor data produces `NO_DATA`/`NO SIGNAL` behavior; it is never
  silently treated as healthy.
- A WATCH finding prevents a `FINE` label. Any WATCH or ALERT is at least
  `CAUTION`.
- Bone and muscle forecasts are long-horizon, simulated models. Day 5 of the
  demo does not model instant tissue recovery.
- Firebase bearer access requires a verified email and an active Firestore
  profile. Live Firebase Admin bearer testing was not possible in the current
  environment because service-account credentials are absent.
- The 600 mSv radiation reference is a simplified public figure, not a current
  NASA flight rule. Verify applicable standards before operational use.

See [LIMITATIONS_AND_REFERENCES.md](docs/LIMITATIONS_AND_REFERENCES.md) for the
full limitations and reference caveats.
