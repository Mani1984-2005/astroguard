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
24.22.1 and Python 3.15.1; other versions were not tested.

```powershell
cd C:\path\to\astroguard
npm install
python -m pip install -r python_engine/requirements.txt
npm run dev
```

Open <http://127.0.0.1:3000> (or the value of `PORT` if you override it). Express
binds to loopback by default. Set `HOST` only when external access is explicitly
required; the server prints a warning when that override is used.

The Express server starts the Python bridge on demand. The Python service is not
publicly exposed; all browser health calls pass through the authenticated
`/api/health/*` routes on the Express server.

Express does not trust forwarded headers by default. If deploying behind a
reverse proxy, set `TRUST_PROXY` to the exact trusted proxy hop count or to
comma-separated trusted proxy IP/CIDR values so client IP and HTTPS cookie
handling use only the configured proxy chain. Set `TRUSTED_ORIGINS` to the exact
public origin(s) if the proxy rewrites the browser-visible `Host`.

## Medical Chief access

Set `MEDICAL_CHIEF_EMAIL` to the Firebase account email, then provision the
Medical Chief password hash without putting a password in the repository:

```powershell
$env:MEDICAL_CHIEF_EMAIL = "chief@example.org"
npx tsx scripts/provision-medical-chief.ts --stdin
```

That command reads the password from standard input and writes the local
server-side auth store at `server-data/medical-chief-auth.json`. It does not
print the password or hash. Do not commit generated auth files or passwords.
Alternatively, set a scrypt `MEDICAL_CHIEF_PASSWORD_HASH` in the server
environment and let the server use the `ENV_HASH` auth source.

Role assignment has no email-based bootstrap backdoor. Firestore authorization
comes from an active `users/{uid}` profile or the server-issued
`astroguardRole: MEDICAL_CHIEF` custom claim. The first Chief account and its
`provisionedAccounts/{email}` binding must be created by a trusted operator
using the Firebase Console/Admin SDK or an existing Chief session.

For a local demonstration without Firebase Admin credentials, use the Medical
Chief login and select the built-in **LOCAL DEMO READY** 4-crew workspace. This
data is held in memory for that signed-in session and is not written to
Firestore.

## Verification

```powershell
npm run lint
npm run build
npm run test:python
npm run test:security
npm run test:integration
npm run test:bridge-timeout
npm run demo:scenario
npm audit --omit=dev
```

The Python suite covers all eleven domains, invalid and missing measurements,
critical-alert forcing, WATCH-to-CAUTION behavior, severe self-reported stress
escalation, repeatability, countermeasure completion, and FastAPI
success/failure responses. `test:security` starts an isolated dev server and
checks `/@fs/`, encoded, traversal, cross-origin, security-header, and
external-binding paths without printing file contents. `test:integration`
exercises the real Express-to-Python bridge and logout session revocation.
`test:bridge-timeout` forces a hung stub worker to verify timeout termination
and replacement-worker recovery.

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
- A severe self-reported stress score (prototype escalation guard: 8/10 or more
  over three days) independently forces the stress domain to `ALERT`; it cannot
  be averaged away by otherwise normal inputs.
- Bone and muscle forecasts are long-horizon, simulated models. Day 5 of the
  demo does not model instant tissue recovery.
- The muscle model reports held-out synthetic metrics, including a
  mean-prediction baseline comparison. Those numbers are not clinical
  validation.
- Firebase bearer access requires a verified email and an active Firestore
  profile. Live Firebase Admin bearer testing was not possible in the current
  environment because service-account credentials are absent.
- The 600 mSv radiation reference is a simplified public figure, not a current
  NASA flight rule. Verify applicable standards before operational use.

See [LIMITATIONS_AND_REFERENCES.md](docs/LIMITATIONS_AND_REFERENCES.md) for the
full limitations and reference caveats.
