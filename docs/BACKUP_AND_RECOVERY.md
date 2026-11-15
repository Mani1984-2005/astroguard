# Backup and Recovery

## 1. What is persistent

AstroGuard has two different kinds of state:

| State | Location | Persistence |
|---|---|---|
| Source code, docs, rules | `E:\astroguard` | Git working tree |
| Medical Chief auth store | `server-data/medical-chief-auth.json` | Local file, ignored by Git |
| Session signing key | `server-data/session-hmac.key` | Local file, ignored by Git |
| Local demo roster/alerts | Browser/server memory | Lost on reload or server restart |
| Python five-day output | `python_engine/demo_output/` | Regenerated, ignored by Git |
| Firebase data | Firestore project | External; not backed up by these commands |

`server-data/` and `.env*` contain local credentials. Do not put them in a public
archive, commit them, upload them, or include them in a demo handout.

## 2. Back up the source tree

Stop the development server before copying files. From `E:\astroguard`:

```powershell
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$dest = "C:\Users\naman\AppData\Local\Temp\opencode\astroguard-backup-$stamp"
New-Item -ItemType Directory -Path $dest | Out-Null
Copy-Item README.md, package.json, package-lock.json, tsconfig.json, vite.config.ts, server.ts, firestore.rules, firebase-blueprint.json, firebase-applet-config.json, .env.example -Destination $dest
Copy-Item src, docs, python_engine, scripts -Destination $dest -Recurse
```

If this repository is tracked by Git, a committed snapshot is normally the best
backup. This project was not committed during the Stage 3 QA pass, so verify the
working-tree state before relying on a Git-only backup.

## 3. Back up local auth state separately

Only if you need to preserve the current local Medical Chief login:

```powershell
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$dest = "C:\Users\naman\AppData\Local\Temp\opencode\astroguard-runtime-$stamp"
New-Item -ItemType Directory -Path $dest | Out-Null
Copy-Item server-data -Destination $dest -Recurse
```

Treat that folder as a secret. Do not send it to another person or attach it to a
hackathon submission. If in doubt, do not back it up; re-provision the Medical
Chief instead.

## 4. Back up Firestore

If Firebase is configured, use the Firebase console's Firestore export/import
feature or your organization's existing Google Cloud backup process. No Firestore
export was performed in this QA pass because Firebase Admin credentials were not
available. Do not assume that copying `firebase-applet-config.json` backs up
Firestore data; it contains public client configuration, not the database.

## 5. Restore the application

1. Restore the project files to the chosen project directory.
2. Install dependencies:

   ```powershell
   npm install
   python -m pip install -r python_engine/requirements.txt
   ```

3. Restore `server-data/` only if you intentionally backed it up. Otherwise
   provision a new Medical Chief credential:

   ```powershell
   $env:MEDICAL_CHIEF_EMAIL = "chief@example.org"
   npx tsx scripts/provision-medical-chief.ts --stdin
   ```

   This writes `server-data/medical-chief-auth.json`; it does not print the
   password or hash. If your deployment uses the environment-hash path instead,
   set a scrypt `MEDICAL_CHIEF_PASSWORD_HASH` in the server environment. There is
   no email-based Firestore bootstrap role; create the first provisioned account
   binding through the Firebase Console/Admin SDK or an existing Chief session.
4. Restore a Firestore export only through the Firebase/Google Cloud tooling for
   the intended project.
5. Start the server:

   ```powershell
   npm run dev
   ```

6. Open `http://127.0.0.1:3102` and verify the login screen. If Firebase Admin is
   not configured, use the local demo path.

## 6. Recover a lost local demo state

Local demo state is not persistent by design. Return to the Medical Chief
workspace and select **Reset Local 4-Crew Demo Scenario**. If the server was
restarted, sign in again; the baseline four-crew demo state is recreated in
memory.

## 7. Verify a recovery

```powershell
npm run lint
npm run build
npm run test:python
npm run demo:scenario
npm audit --omit=dev
```

Then check:

- `/api/auth/status` responds;
- Medical Chief login works;
- an astronaut can read only its own crew;
- a cross-crew request returns `403`;
- direct `/python_engine/...` and `/server-data/...` requests return `404`;
- the local demo shows `LOCAL DEMO READY`.

## 8. Recovery limits

- There is no production database backup service in this repository.
- There is no high-availability or disaster-recovery deployment.
- Local demo data is intentionally disposable.
- A page reload discards unsaved local demo changes.
- A Firebase data restore is outside the scope of this local demo and was not
  exercised here.
