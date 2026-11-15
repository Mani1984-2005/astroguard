# AstroGuard Final Judge Demo

## Deliverables

- [AstroGuard_Final_Judge_Demo.mp4](./AstroGuard_Final_Judge_Demo.mp4) — final 30-second demonstration.
- [AstroGuard_First_Judge_Demo.mp4](./AstroGuard_First_Judge_Demo.mp4) — preserved first recording.

## Captured features

| Time | Actual application content |
|---|---|
| 0–3s | AstroGuard mission portal and Orbit Vitals caption |
| 3–8s | Simulated crew profiles for Cmdr. Elena Vance and Dr. Kenji Takahashi, showing their distinct dashboards |
| 8–10s | Simulated ECG waveform and health summary |
| 10–14s | Python readiness panel, including score, coverage, flags, missing channels, and parameter breakdown |
| 14–22s | Medical Chief authentication boundary; no credentials were entered |
| 22–25s | Countermeasure schedule and completion status |
| 25–27s | Mission guidance, recommended actions, ECG, and health summary |
| 27–30s | AstroGuard brand card and “MONITOR. PROTECT. EXPLORE.” |

All astronaut data and health displays shown are simulated. The video does not present them as real telemetry or medical diagnosis. Countermeasure completion controls were not activated.

## Medical Chief access limitation

The authenticated Medical Chief workspace was **not** captured. The host reported that password authentication and Firebase Admin were not configured, and no authorized demo account was available. Only the legitimate authentication screen is shown; no password was guessed or submitted. The roster, alerts, and Chief-only trends are therefore not demonstrated.

## Verification

- MP4 container; H.264 video and AAC stereo audio.
- Exactly **30.000 seconds**; 1,800 frames at 60 fps; 48 kHz audio.
- 3840 × 2160 output, upscaled from 1920 × 1080 browser captures.
- Full video/audio decode succeeded; no full-black intervals were detected.
- Representative frames were reviewed for both crew profiles, the ECG, Python panel, authorization screen, countermeasures, guidance, and closing card.
- The browser capture cadence was 30 fps; the 60 fps output duplicates capture frames rather than representing native 60 fps acquisition.
- Ambient music is generated for this demo; no third-party music was added.
- Application source code was not changed. The original recording was preserved, and no persistent countermeasure state was changed.
