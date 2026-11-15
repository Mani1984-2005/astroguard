# Limitations and References

## 1. Demonstration status

AstroGuard is a hackathon demonstration. It is **not** a medical device, a
clinical decision-support system, an operational flight tool, or a NASA product.
No clinical validation, regulatory review, or NASA endorsement has been
performed or is claimed.

All crew names, biographies, vitals, alerts, daily logs, exercise prescriptions,
and five-day outcomes are simulated. They are not real astronaut medical data.

## 2. Health-engine limitations

- The eleven-domain rules are prototype demonstration thresholds. They are not
  derived from a formal clinical evidence review.
- Missing or invalid measurements are surfaced as missing data. The engine does
  not silently substitute a healthy value.
- A WATCH finding prevents `FINE`; a report with any WATCH is at least
  `CAUTION`.
- Severe self-reported stress (prototype guard: 8/10 or more over three days)
  independently forces the stress domain to `ALERT`. The 6/10 WATCH and 8/10
  ALERT guards are policy placeholders, not validated psychological cut-offs.
- Four or more missing domains with no alert can produce `NO SIGNAL`.
- Bone and muscle estimates are long-horizon, simulated models. They are not
  instant recovery predictions and must not be read as tissue-healing claims.
- The current muscle model's held-out synthetic metrics are next-30-day MAE
  `0.198%` (mean-prediction baseline `1.005%`, about `80%` lower error) and
  R² `0.911`; cumulative MAE is `0.584%` and R² `0.923`. These are
  simulated-label diagnostics only, not real astronaut accuracy.
- The Day 5 scenario is `CAUTION`, not `FINE`; one WATCH domain remains.
- Blood-pressure simulation is limited by the telemetry snapshot shape. The
  Python daily log uses the crew profile's blood-pressure fields, so a live UI
  blood-pressure excursion is not necessarily reflected in the Python report.
- The Python report is an additive layer. If the bridge is unavailable, the
  synchronous TypeScript evaluation remains the fallback.

## 3. Data and simulation limitations

- The frontend maps interval telemetry into a seven-row demonstration log.
  Snapshot-only values are placed on the latest row; unavailable historical
  measurements remain missing. Exercise history is not available from the UI,
  so Python bone and muscle domains report `NO_DATA` for that input.
- The Python report is computed on demand and is not a persistent medical
  record.
- Local demo state is held in memory for the signed-in session. A page reload or
  server restart discards it.
- Firebase-backed data is used only when the optional Firebase configuration is
  present. The local environment did not have Firebase Admin service-account
  credentials, so live Firebase bearer-token authentication was **not tested**.
- The simulated crew portal is a demo-only identity path. It accepts fictional
  crew selection without an email account.
- No public deployment was performed as part of this QA pass.

## 4. Authorization limitations

- Express is the public health-data boundary. The Python service has no
  authentication of its own and must remain loopback-only.
- Signed cookies are appropriate for this local demonstration, not a substitute
  for a full production identity provider.
- Cross-crew access, unauthorized access, Medical Chief-only simulation, and
  invalid simulation rejection were exercised in local integration tests.
- The Firebase bearer path requires `email_verified === true` and an active
  Firestore profile. Its live behavior could not be exercised without Admin
  credentials.

## 5. NASA and program-level references

The prototype uses the following **program-level topic references** only. These
are not article-level citations, and this document does not assert a DOI, URL,
specific paper, or NASA endorsement.

| Reference area | Use in AstroGuard |
|---|---|
| NASA Human Research Program (HRP) | Context for SANS, cardiovascular adaptation, and human spaceflight health risks |
| NASA Johnson Space Center Bone & Mineral Laboratory | Context for bone loss and exercise-countermeasure topics |
| NASA Space Radiation Analysis Group (SRAG) | Context for radiation dosimetry and career-limit topics |
| NASA-STD-3001 (NASA Space Flight Human-System Standard) | A standard to consult when checking current crew health requirements |

The 600 mSv radiation value in the prototype is a simplified public reference,
not a live NASA flight rule. Confirm the applicable current standard before any
operational use. The in-app Research & Evidence Context page describes topics
and prototype implications; it does not claim a formal evidence grade.

## 6. What remains unverified

- Live Firebase bearer-token authentication with real Admin credentials.
- Production deployment, TLS termination, and public exposure.
- Clinical accuracy, diagnostic sensitivity/specificity, and patient outcomes.
- Long-duration mission performance, real sensor integration, and flight
  certification.
- Instant bone or muscle recovery from any countermeasure.
