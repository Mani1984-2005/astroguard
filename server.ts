import 'dotenv/config';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import express, { type Request, type Response } from 'express';
import { type App as AdminApp, cert, getApps, initializeApp } from 'firebase-admin/app';
import { type Auth as AdminAuth, getAuth } from 'firebase-admin/auth';
import { FieldValue, type Firestore, getFirestore } from 'firebase-admin/firestore';

interface FirebaseAppletConfig {
  projectId: string;
  firestoreDatabaseId?: string;
}

interface RateLimitRecord {
  failures: number;
  windowStartMs: number;
  lockedUntilMs: number;
}

interface SignedCrewSessionPayload {
  crewId: string;
  role: 'ASTRONAUT';
  mode: 'SIMULATION_CREW';
  sessionId: string;
  iat: number;
  exp: number;
}

interface SignedChiefSessionPayload {
  uid: string;
  email: string;
  displayName: string;
  role: 'MEDICAL_CHIEF';
  crewId: 'MCC-ALL';
  sessionId: string;
  iat: number;
  exp: number;
}

interface ProvisionedChiefRecord {
  userId: string;
  email: string;
  displayName: string;
  role: 'MEDICAL_CHIEF';
  crewId: 'MCC-ALL';
  accountStatus: 'ACTIVE';
  passwordHash: string;
  createdAt: string;
  updatedAt: string;
  passwordUpdatedAt: string;
  rotatedByUser?: boolean;
}

const PORT = Number(process.env.PORT || 3000);
const ALLOWED_CREW_IDS = new Set(['AG-LEO-01', 'AG-LEO-02', 'AG-LEO-03', 'AG-LEO-04']);
const BOOTSTRAPPED_CHIEF_EMAIL = (
  process.env.MEDICAL_CHIEF_EMAIL || 'manikantadindawar21@gmail.com'
)
  .trim()
  .toLowerCase();

const MAX_FAILED_ATTEMPTS = 5;
const RATE_WINDOW_MS = 15 * 60 * 1000;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000;
const CREW_SESSION_TTL_MS = 8 * 60 * 60 * 1000;
const AUDIT_LOG_PATH = '/tmp/astroguard-security-audit.log';
const AUTH_STORE_DIR = path.resolve(process.cwd(), 'server-data');
const CHIEF_AUTH_STORE_PATH = path.join(AUTH_STORE_DIR, 'medical-chief-auth.json');
const HMAC_KEY_PATH = path.join(AUTH_STORE_DIR, 'session-hmac.key');

function loadOrCreateSessionHmacSecret(): string {
  const envSecret = process.env.SESSION_HMAC_SECRET?.trim();
  if (envSecret && envSecret.length >= 32) {
    return envSecret;
  }
  try {
    if (fs.existsSync(HMAC_KEY_PATH)) {
      const existing = fs.readFileSync(HMAC_KEY_PATH, 'utf8').trim();
      if (existing.length >= 32) {
        return existing;
      }
    }
    const generated = crypto.randomBytes(32).toString('hex');
    fs.mkdirSync(AUTH_STORE_DIR, { recursive: true, mode: 0o700 });
    fs.writeFileSync(HMAC_KEY_PATH, generated + '\n', { mode: 0o600 });
    return generated;
  } catch {
    return crypto.randomBytes(32).toString('hex');
  }
}

const SESSION_HMAC_SECRET = loadOrCreateSessionHmacSecret();

const rateLimitByIp = new Map<string, RateLimitRecord>();

function readAppletConfig(): FirebaseAppletConfig {
  const cfgPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
  const raw = fs.readFileSync(cfgPath, 'utf8');
  return JSON.parse(raw) as FirebaseAppletConfig;
}

let adminApp: AdminApp | null = null;
let adminAuth: AdminAuth | null = null;
let adminDb: Firestore | null = null;

function initFirebaseAdmin(): void {
  if (adminApp) return;
  const cfg = readAppletConfig();
  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT?.trim();
  const googleCredsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim();

  if (!serviceAccountJson && !googleCredsPath) {
    return;
  }

  try {
    if (getApps().length > 0) {
      adminApp = getApps()[0];
    } else if (serviceAccountJson) {
      const parsed = JSON.parse(serviceAccountJson) as Record<string, string>;
      adminApp = initializeApp({
        credential: cert(parsed),
        projectId: cfg.projectId
      });
    } else {
      adminApp = initializeApp({
        projectId: cfg.projectId
      });
    }

    adminAuth = getAuth(adminApp);
    adminDb = cfg.firestoreDatabaseId
      ? getFirestore(adminApp, cfg.firestoreDatabaseId)
      : getFirestore(adminApp);
  } catch (err) {
    console.error('[AstroGuard Server] Failed to initialize Firebase Admin SDK:', err);
    adminApp = null;
    adminAuth = null;
    adminDb = null;
  }
}

initFirebaseAdmin();

function getClientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.length > 0) {
    return forwarded.split(',')[0].trim();
  }
  return req.ip || req.socket.remoteAddress || 'unknown';
}

function hashIpForAudit(ip: string): string {
  return crypto.createHash('sha256').update(ip).digest('hex').slice(0, 12);
}

function appendSecurityAudit(entry: {
  eventType: string;
  actor: string;
  target: string;
  outcome: 'ALLOWED' | 'DENIED' | 'LOCKED' | 'CONFIG_ERROR';
  ip: string;
  details: string;
}): void {
  const record = {
    ts: new Date().toISOString(),
    eventType: entry.eventType,
    actor: entry.actor,
    target: entry.target,
    outcome: entry.outcome,
    ipHash: hashIpForAudit(entry.ip),
    details: entry.details
  };
  try {
    fs.appendFileSync(AUDIT_LOG_PATH, JSON.stringify(record) + '\n', { mode: 0o600 });
  } catch {
    // Non-fatal if /tmp is unavailable
  }

  if (adminDb) {
    const logId = `SRV_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
    void adminDb
      .collection('auditLogs')
      .doc(logId)
      .set({
        logId,
        actorUserId: entry.actor.slice(0, 128),
        actorEmail: BOOTSTRAPPED_CHIEF_EMAIL,
        actorRole: 'MEDICAL_CHIEF',
        action: entry.eventType.slice(0, 120),
        targetRecord: entry.target.slice(0, 200),
        details: `${entry.details} [ip:${record.ipHash}]`.slice(0, 500),
        createdAt: FieldValue.serverTimestamp()
      })
      .catch(() => {});
  }
}

function isValidScryptFormat(storedHash: string): boolean {
  const parts = storedHash.trim().split('$');
  if (parts.length !== 3 || parts[0] !== 'scrypt') {
    return false;
  }
  const [, saltHex, expectedHex] = parts;
  return /^[0-9a-f]+$/i.test(saltHex) && /^[0-9a-f]+$/i.test(expectedHex);
}

function hashScryptPassword(password: string): string {
  const saltHex = crypto.randomBytes(16).toString('hex');
  const derivedHex = crypto.scryptSync(password, saltHex, 64).toString('hex');
  return `scrypt$${saltHex}$${derivedHex}`;
}

function verifyScryptPassword(candidate: string, storedHash: string): boolean {
  if (!isValidScryptFormat(storedHash)) {
    return false;
  }
  const [, saltHex, expectedHex] = storedHash.trim().split('$');
  const expectedBuf = Buffer.from(expectedHex, 'hex');
  const derivedBuf = crypto.scryptSync(candidate, saltHex, expectedBuf.length);
  if (derivedBuf.length !== expectedBuf.length) {
    return false;
  }
  return crypto.timingSafeEqual(derivedBuf, expectedBuf);
}

function readProvisionedChiefAccount(): ProvisionedChiefRecord | null {
  try {
    if (!fs.existsSync(CHIEF_AUTH_STORE_PATH)) return null;
    const raw = fs.readFileSync(CHIEF_AUTH_STORE_PATH, 'utf8');
    const parsed = JSON.parse(raw) as Partial<ProvisionedChiefRecord>;
    if (
      parsed.role !== 'MEDICAL_CHIEF' ||
      parsed.accountStatus !== 'ACTIVE' ||
      typeof parsed.passwordHash !== 'string' ||
      !isValidScryptFormat(parsed.passwordHash)
    ) {
      return null;
    }
    return {
      userId: parsed.userId || 'MCC_CHIEF_PRIMARY',
      email: (parsed.email || BOOTSTRAPPED_CHIEF_EMAIL).trim().toLowerCase(),
      displayName: parsed.displayName || 'Dr. M. Thorne (Medical Chief)',
      role: 'MEDICAL_CHIEF',
      crewId: 'MCC-ALL',
      accountStatus: 'ACTIVE',
      passwordHash: parsed.passwordHash,
      createdAt: parsed.createdAt || new Date().toISOString(),
      updatedAt: parsed.updatedAt || new Date().toISOString(),
      passwordUpdatedAt: parsed.passwordUpdatedAt || new Date().toISOString(),
      rotatedByUser: Boolean(parsed.rotatedByUser)
    };
  } catch {
    return null;
  }
}

function writeProvisionedChiefAccount(record: ProvisionedChiefRecord): void {
  fs.mkdirSync(AUTH_STORE_DIR, { recursive: true, mode: 0o700 });
  fs.writeFileSync(CHIEF_AUTH_STORE_PATH, JSON.stringify(record, null, 2) + '\n', {
    mode: 0o600
  });
}

function getActiveChiefAuthConfig(): {
  passwordHash: string;
  authSource: 'ENV_HASH' | 'PROVISIONED_STORE' | 'NONE';
  account: ProvisionedChiefRecord;
} | null {
  const stored = readProvisionedChiefAccount();
  const envHash = process.env.MEDICAL_CHIEF_PASSWORD_HASH?.trim() || '';
  const hasValidEnvHash = isValidScryptFormat(envHash);

  if (stored?.rotatedByUser) {
    return {
      passwordHash: stored.passwordHash,
      authSource: 'PROVISIONED_STORE',
      account: stored
    };
  }

  if (hasValidEnvHash) {
    return {
      passwordHash: envHash,
      authSource: 'ENV_HASH',
      account: stored || {
        userId: 'MCC_CHIEF_PRIMARY',
        email: BOOTSTRAPPED_CHIEF_EMAIL,
        displayName: 'Dr. M. Thorne (Medical Chief)',
        role: 'MEDICAL_CHIEF',
        crewId: 'MCC-ALL',
        accountStatus: 'ACTIVE',
        passwordHash: envHash,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        passwordUpdatedAt: new Date().toISOString()
      }
    };
  }

  if (stored) {
    return {
      passwordHash: stored.passwordHash,
      authSource: 'PROVISIONED_STORE',
      account: stored
    };
  }

  return null;
}

function checkRateLimit(ip: string): { allowed: boolean; retryAfterSec: number } {
  const now = Date.now();
  const rec = rateLimitByIp.get(ip);
  if (!rec) return { allowed: true, retryAfterSec: 0 };

  if (rec.lockedUntilMs > now) {
    return {
      allowed: false,
      retryAfterSec: Math.ceil((rec.lockedUntilMs - now) / 1000)
    };
  }

  if (now - rec.windowStartMs > RATE_WINDOW_MS) {
    rateLimitByIp.delete(ip);
    return { allowed: true, retryAfterSec: 0 };
  }

  return { allowed: true, retryAfterSec: 0 };
}

function recordFailedAttempt(ip: string): { locked: boolean; retryAfterSec: number } {
  const now = Date.now();
  const existing = rateLimitByIp.get(ip);
  if (!existing || now - existing.windowStartMs > RATE_WINDOW_MS) {
    rateLimitByIp.set(ip, { failures: 1, windowStartMs: now, lockedUntilMs: 0 });
    return { locked: false, retryAfterSec: 0 };
  }

  const nextFailures = existing.failures + 1;
  if (nextFailures >= MAX_FAILED_ATTEMPTS) {
    const lockedUntilMs = now + LOCKOUT_DURATION_MS;
    rateLimitByIp.set(ip, {
      failures: nextFailures,
      windowStartMs: existing.windowStartMs,
      lockedUntilMs
    });
    return { locked: true, retryAfterSec: Math.ceil(LOCKOUT_DURATION_MS / 1000) };
  }

  rateLimitByIp.set(ip, {
    failures: nextFailures,
    windowStartMs: existing.windowStartMs,
    lockedUntilMs: 0
  });
  return { locked: false, retryAfterSec: 0 };
}

function signSessionToken(payload: object): string {
  const encoded = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const sig = crypto
    .createHmac('sha256', SESSION_HMAC_SECRET)
    .update(encoded)
    .digest('base64url');
  return `${encoded}.${sig}`;
}

function verifySessionToken<T>(token: string): T | null {
  const dotIdx = token.indexOf('.');
  if (dotIdx <= 0) return null;
  const encoded = token.slice(0, dotIdx);
  const sig = token.slice(dotIdx + 1);
  const expectedSig = crypto
    .createHmac('sha256', SESSION_HMAC_SECRET)
    .update(encoded)
    .digest('base64url');

  const sigBuf = Buffer.from(sig, 'utf8');
  const expectedBuf = Buffer.from(expectedSig, 'utf8');
  if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
    return null;
  }

  try {
    const parsed = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as T & {
      exp?: number;
    };
    if (typeof parsed.exp === 'number' && parsed.exp < Date.now()) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function parseCookies(req: Request): Record<string, string> {
  const header = req.headers.cookie;
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const part of header.split(';')) {
    const eqIdx = part.indexOf('=');
    if (eqIdx === -1) continue;
    const key = part.slice(0, eqIdx).trim();
    const val = decodeURIComponent(part.slice(eqIdx + 1).trim());
    out[key] = val;
  }
  return out;
}

function isHttpsRequest(req: Request): boolean {
  const xfProto = req.headers['x-forwarded-proto'];
  return (
    req.secure ||
    (typeof xfProto === 'string' && xfProto.split(',')[0].trim().toLowerCase() === 'https')
  );
}

function setHttpOnlyCookie(
  req: Request,
  res: Response,
  name: string,
  value: string,
  maxAgeSec: number
): void {
  const https = isHttpsRequest(req);
  const attrs = [
    `${name}=${encodeURIComponent(value)}`,
    'Path=/',
    'HttpOnly',
    https ? 'SameSite=None' : 'SameSite=Lax',
    `Max-Age=${maxAgeSec}`
  ];
  if (https) {
    attrs.push('Secure', 'Partitioned');
  }
  res.append('Set-Cookie', attrs.join('; '));
}

function clearHttpOnlyCookie(req: Request, res: Response, name: string): void {
  const https = isHttpsRequest(req);
  const attrs = [
    `${name}=`,
    'Path=/',
    'HttpOnly',
    https ? 'SameSite=None' : 'SameSite=Lax',
    'Max-Age=0'
  ];
  if (https) {
    attrs.push('Secure', 'Partitioned');
  }
  res.append('Set-Cookie', attrs.join('; '));
}

function getVerifiedChiefSession(req: Request): SignedChiefSessionPayload | null {
  const cookies = parseCookies(req);
  const token = cookies['astroguard_chief_session'];
  if (!token) return null;
  const verified = verifySessionToken<SignedChiefSessionPayload>(token);
  if (!verified || verified.role !== 'MEDICAL_CHIEF' || verified.crewId !== 'MCC-ALL') {
    return null;
  }
  return verified;
}

async function startServer(): Promise<void> {
  const app = express();
  app.set('trust proxy', 1);
  app.use(express.json({ limit: '16kb' }));

  // Block direct HTTP access to server-side secrets, auth store, scripts, or rules files
  app.use((req: Request, res: Response, next) => {
    const normalizedPath = req.path.toLowerCase();
    if (
      normalizedPath.startsWith('/server-data') ||
      normalizedPath.startsWith('/.astroguard-server') ||
      normalizedPath.startsWith('/scripts') ||
      normalizedPath.startsWith('/.env') ||
      normalizedPath === '/server.ts' ||
      normalizedPath === '/firestore.rules' ||
      normalizedPath === '/firebase-blueprint.json'
    ) {
      res.status(404).end();
      return;
    }
    next();
  });

  // Zero-404 asset discovery manifest for optional user-supplied Earth textures & GLB/GLTF satellite models
  app.get('/api/orbital-assets/manifest', (_req: Request, res: Response) => {
    const publicRoot = path.resolve(process.cwd(), 'public', 'assets');
    const findFirstAsset = (subDir: string, baseName: string, exts: string[]): string | null => {
      for (const ext of exts) {
        const candidate = path.join(publicRoot, subDir, `${baseName}.${ext}`);
        if (fs.existsSync(candidate)) {
          return `/assets/${subDir}/${baseName}.${ext}`;
        }
      }
      return null;
    };

    const imageExts = ['jpg', 'jpeg', 'png', 'webp'];
    const modelExts = ['glb', 'gltf'];

    res.json({
      earth: {
        dayMap: findFirstAsset('earth', 'earth_day', imageExts),
        nightMap: findFirstAsset('earth', 'earth_night', imageExts),
        normalMap: findFirstAsset('earth', 'earth_normal', imageExts),
        cloudMap: findFirstAsset('earth', 'earth_clouds', imageExts)
      },
      satellites: {
        primary: findFirstAsset('models', 'satellite_primary', modelExts),
        relay: findFirstAsset('models', 'satellite_relay', modelExts),
        sentinel: findFirstAsset('models', 'satellite_sentinel', modelExts)
      }
    });
  });

  // Non-sensitive backend readiness check
  app.get('/api/auth/status', (_req: Request, res: Response) => {
    const activeConfig = getActiveChiefAuthConfig();
    res.json({
      passwordAuthConfigured: Boolean(activeConfig),
      authSource: activeConfig?.authSource || 'NONE',
      firebaseAdminConfigured: Boolean(adminAuth && adminDb)
    });
  });

  // Protected Medical Chief Password Verification -> Issues HttpOnly Signed Session (+ Firebase Custom Token when Admin SDK is configured)
  app.post('/api/auth/medical-chief', async (req: Request, res: Response) => {
    const ip = getClientIp(req);
    const rate = checkRateLimit(ip);
    if (!rate.allowed) {
      appendSecurityAudit({
        eventType: 'CHIEF_AUTH_RATE_LIMITED',
        actor: 'UNAUTHENTICATED',
        target: 'portal/medical-chief',
        outcome: 'LOCKED',
        ip,
        details: `Rate limit exceeded; locked for ${rate.retryAfterSec}s.`
      });
      res.setHeader('Retry-After', String(rate.retryAfterSec));
      res.status(429).json({
        ok: false,
        code: 'RATE_LIMITED',
        retryAfterSec: rate.retryAfterSec,
        error: 'Too many failed authorization attempts. Terminal temporarily locked.'
      });
      return;
    }

    const body = req.body as { password?: unknown } | undefined;
    const password = typeof body?.password === 'string' ? body.password : '';
    if (!password || password.length > 256) {
      recordFailedAttempt(ip);
      res.status(400).json({
        ok: false,
        code: 'INVALID_REQUEST',
        error: 'Enter a valid Medical Chief access password.'
      });
      return;
    }

    const activeConfig = getActiveChiefAuthConfig();
    if (!activeConfig) {
      appendSecurityAudit({
        eventType: 'CHIEF_AUTH_UNCONFIGURED',
        actor: 'SYSTEM',
        target: 'portal/medical-chief',
        outcome: 'CONFIG_ERROR',
        ip,
        details: 'No provisioned Medical Chief SCRYPT hash found on server.'
      });
      res.status(503).json({
        ok: false,
        code: 'BACKEND_AUTH_NOT_CONFIGURED',
        configurationRequired: true,
        error:
          'Backend Medical Chief password verification is not yet provisioned.'
      });
      return;
    }

    const passwordValid = verifyScryptPassword(password, activeConfig.passwordHash);
    if (!passwordValid) {
      const failState = recordFailedAttempt(ip);
      appendSecurityAudit({
        eventType: 'CHIEF_AUTH_FAILED',
        actor: 'UNAUTHENTICATED',
        target: 'portal/medical-chief',
        outcome: failState.locked ? 'LOCKED' : 'DENIED',
        ip,
        details: failState.locked
          ? `Invalid Medical Chief password; IP locked for ${failState.retryAfterSec}s.`
          : 'Invalid Medical Chief password attempt.'
      });
      if (failState.locked) {
        res.setHeader('Retry-After', String(failState.retryAfterSec));
        res.status(429).json({
          ok: false,
          code: 'RATE_LIMITED',
          retryAfterSec: failState.retryAfterSec,
          error: 'Too many failed authorization attempts. Terminal temporarily locked.'
        });
        return;
      }
      // Uniform non-enumerating error message
      res.status(401).json({
        ok: false,
        code: 'AUTH_DENIED',
        error: 'Access denied. Invalid authorization credentials.'
      });
      return;
    }

    // If Firebase Admin SDK is configured, also enforce Firebase user/role verification and mint Custom Token
    if (adminAuth && adminDb) {
      try {
        const userRecord = await adminAuth.getUserByEmail(activeConfig.account.email);
        if (!userRecord.emailVerified) {
          appendSecurityAudit({
            eventType: 'CHIEF_AUTH_UNVERIFIED_ACCOUNT',
            actor: userRecord.uid,
            target: 'portal/medical-chief',
            outcome: 'DENIED',
            ip,
            details: 'Provisioned Medical Chief Firebase account does not have a verified email.'
          });
          res.status(403).json({
            ok: false,
            code: 'AUTH_DENIED',
            error: 'Access denied. Invalid authorization credentials.'
          });
          return;
        }

        const userSnap = await adminDb.collection('users').doc(userRecord.uid).get();
        if (userSnap.exists) {
          const userData = userSnap.data();
          if (userData?.role !== 'MEDICAL_CHIEF' || userData?.accountStatus !== 'ACTIVE') {
            appendSecurityAudit({
              eventType: 'CHIEF_AUTH_ROLE_REJECTED',
              actor: userRecord.uid,
              target: 'portal/medical-chief',
              outcome: 'DENIED',
              ip,
              details: `Account role (${String(userData?.role)}) is not active MEDICAL_CHIEF.`
            });
            res.status(403).json({
              ok: false,
              code: 'AUTH_DENIED',
              error: 'Access denied. Account is not authorized for Medical Chief access.'
            });
            return;
          }
        }

        rateLimitByIp.delete(ip);
        const customToken = await adminAuth.createCustomToken(userRecord.uid, {
          astroguardRole: 'MEDICAL_CHIEF',
          authMethod: 'MCC_PASSWORD_TERMINAL'
        });

        const chiefSessionPayload: SignedChiefSessionPayload = {
          uid: userRecord.uid,
          email: userRecord.email || activeConfig.account.email,
          displayName: userRecord.displayName || activeConfig.account.displayName,
          role: 'MEDICAL_CHIEF',
          crewId: 'MCC-ALL',
          sessionId: crypto.randomBytes(12).toString('hex'),
          iat: Date.now(),
          exp: Date.now() + CREW_SESSION_TTL_MS
        };
        const chiefSessionToken = signSessionToken(chiefSessionPayload);
        setHttpOnlyCookie(req, res, 'astroguard_chief_session', chiefSessionToken, 8 * 3600);
        clearHttpOnlyCookie(req, res, 'astroguard_crew_session');

        appendSecurityAudit({
          eventType: 'MEDICAL_CHIEF_AUTHORIZED',
          actor: userRecord.uid,
          target: 'portal/medical-chief',
          outcome: 'ALLOWED',
          ip,
          details: 'Medical Chief password verified and Firebase custom token issued.'
        });

        res.json({
          ok: true,
          authMode: 'FIREBASE_CUSTOM_TOKEN',
          customToken,
          profile: {
            userId: chiefSessionPayload.uid,
            email: chiefSessionPayload.email,
            displayName: chiefSessionPayload.displayName,
            role: chiefSessionPayload.role,
            crewId: chiefSessionPayload.crewId,
            accountStatus: 'ACTIVE'
          }
        });
        return;
      } catch (err) {
        console.error('[AstroGuard Server] Firebase custom token issuance failed:', err);
        res.status(401).json({
          ok: false,
          code: 'AUTH_DENIED',
          error: 'Access denied. Invalid authorization credentials.'
        });
        return;
      }
    }

    // Server-signed Medical Chief Session (when Firebase Admin credentials are not attached to host)
    rateLimitByIp.delete(ip);
    const chiefSessionPayload: SignedChiefSessionPayload = {
      uid: activeConfig.account.userId,
      email: activeConfig.account.email,
      displayName: activeConfig.account.displayName,
      role: 'MEDICAL_CHIEF',
      crewId: 'MCC-ALL',
      sessionId: crypto.randomBytes(12).toString('hex'),
      iat: Date.now(),
      exp: Date.now() + CREW_SESSION_TTL_MS
    };
    const chiefSessionToken = signSessionToken(chiefSessionPayload);
    setHttpOnlyCookie(req, res, 'astroguard_chief_session', chiefSessionToken, 8 * 3600);
    clearHttpOnlyCookie(req, res, 'astroguard_crew_session');

    appendSecurityAudit({
      eventType: 'MEDICAL_CHIEF_AUTHORIZED',
      actor: chiefSessionPayload.uid,
      target: 'portal/medical-chief',
      outcome: 'ALLOWED',
      ip,
      details: `Medical Chief password verified against provisioned SCRYPT hash (${activeConfig.authSource}); server session issued.`
    });

    res.json({
      ok: true,
      authMode: 'SERVER_SESSION',
      profile: {
        userId: chiefSessionPayload.uid,
        email: chiefSessionPayload.email,
        displayName: chiefSessionPayload.displayName,
        role: chiefSessionPayload.role,
        crewId: chiefSessionPayload.crewId,
        accountStatus: 'ACTIVE'
      }
    });
  });

  // Verify active HttpOnly Medical Chief Session
  app.get('/api/auth/chief-session', (req: Request, res: Response) => {
    const verified = getVerifiedChiefSession(req);
    if (!verified) {
      clearHttpOnlyCookie(req, res, 'astroguard_chief_session');
      res.status(401).json({ ok: false, error: 'No active Medical Chief session.' });
      return;
    }

    res.json({
      ok: true,
      profile: {
        userId: verified.uid,
        email: verified.email,
        displayName: verified.displayName,
        role: verified.role,
        crewId: verified.crewId,
        accountStatus: 'ACTIVE'
      }
    });
  });

  // Authenticated Medical Chief Password Rotation (requires valid chief session + current password verification)
  app.post('/api/auth/medical-chief/change-password', (req: Request, res: Response) => {
    const ip = getClientIp(req);
    const verified = getVerifiedChiefSession(req);
    if (!verified) {
      res.status(401).json({
        ok: false,
        error: 'Medical Chief authentication session required to rotate password.'
      });
      return;
    }

    const rate = checkRateLimit(ip);
    if (!rate.allowed) {
      res.setHeader('Retry-After', String(rate.retryAfterSec));
      res.status(429).json({
        ok: false,
        retryAfterSec: rate.retryAfterSec,
        error: 'Too many failed verification attempts. Wait before rotating password.'
      });
      return;
    }

    const body = req.body as { currentPassword?: unknown; newPassword?: unknown } | undefined;
    const currentPassword = typeof body?.currentPassword === 'string' ? body.currentPassword : '';
    const newPassword = typeof body?.newPassword === 'string' ? body.newPassword : '';

    if (!currentPassword || !newPassword || newPassword.length < 8 || newPassword.length > 256) {
      res.status(400).json({
        ok: false,
        error: 'Provide your current password and a new password (8–256 characters).'
      });
      return;
    }

    if (currentPassword === newPassword) {
      res.status(400).json({
        ok: false,
        error: 'New access password must differ from the current password.'
      });
      return;
    }

    const activeConfig = getActiveChiefAuthConfig();
    if (!activeConfig || !verifyScryptPassword(currentPassword, activeConfig.passwordHash)) {
      recordFailedAttempt(ip);
      appendSecurityAudit({
        eventType: 'CHIEF_PASSWORD_ROTATE_DENIED',
        actor: verified.uid,
        target: 'portal/medical-chief/password',
        outcome: 'DENIED',
        ip,
        details: 'Current password verification failed during rotation attempt.'
      });
      res.status(401).json({
        ok: false,
        error: 'Current Medical Chief password is incorrect.'
      });
      return;
    }

    const now = new Date().toISOString();
    const updatedRecord: ProvisionedChiefRecord = {
      ...activeConfig.account,
      passwordHash: hashScryptPassword(newPassword),
      updatedAt: now,
      passwordUpdatedAt: now,
      rotatedByUser: true
    };
    writeProvisionedChiefAccount(updatedRecord);
    rateLimitByIp.delete(ip);

    appendSecurityAudit({
      eventType: 'CHIEF_PASSWORD_CHANGED',
      actor: verified.uid,
      target: 'portal/medical-chief/password',
      outcome: 'ALLOWED',
      ip,
      details: 'Medical Chief SCRYPT password hash rotated cleanly.'
    });

    res.json({
      ok: true,
      passwordUpdatedAt: now
    });
  });

  // Protected Server Audit Logs Feed for Medical Chief Security Console
  app.get('/api/auth/audit-logs', (req: Request, res: Response) => {
    const verified = getVerifiedChiefSession(req);
    if (!verified) {
      res.status(401).json({ ok: false, error: 'Medical Chief session required.' });
      return;
    }

    try {
      if (!fs.existsSync(AUDIT_LOG_PATH)) {
        res.json({ ok: true, logs: [] });
        return;
      }
      const lines = fs
        .readFileSync(AUDIT_LOG_PATH, 'utf8')
        .trim()
        .split('\n')
        .filter(Boolean)
        .slice(-50)
        .reverse();

      const logs = lines.map((line, idx) => {
        const entry = JSON.parse(line) as {
          ts: string;
          eventType: string;
          actor: string;
          target: string;
          outcome: string;
          details: string;
        };
        return {
          id: `SRV_LOG_${idx}_${entry.ts}`,
          actorUserId: entry.actor,
          actorEmail: verified.email,
          actorRole: entry.actor.startsWith('SIM_') ? 'ASTRONAUT' : 'MEDICAL_CHIEF',
          action: `${entry.eventType} (${entry.outcome})`,
          targetRecord: entry.target,
          details: entry.details,
          timestamp: entry.ts
        };
      });

      res.json({ ok: true, logs });
    } catch {
      res.json({ ok: true, logs: [] });
    }
  });

  // Bind Simulation Crew Profile to a server-signed HttpOnly session cookie
  app.post('/api/auth/crew-session', (req: Request, res: Response) => {
    const ip = getClientIp(req);
    const body = req.body as { crewId?: unknown } | undefined;
    const crewId = typeof body?.crewId === 'string' ? body.crewId.trim().toUpperCase() : '';

    if (!ALLOWED_CREW_IDS.has(crewId)) {
      res.status(400).json({
        ok: false,
        error: 'Invalid crew identifier.'
      });
      return;
    }

    const now = Date.now();
    const payload: SignedCrewSessionPayload = {
      crewId,
      role: 'ASTRONAUT',
      mode: 'SIMULATION_CREW',
      sessionId: crypto.randomBytes(12).toString('hex'),
      iat: now,
      exp: now + CREW_SESSION_TTL_MS
    };

    const signedToken = signSessionToken(payload);
    setHttpOnlyCookie(req, res, 'astroguard_crew_session', signedToken, 8 * 3600);
    clearHttpOnlyCookie(req, res, 'astroguard_chief_session');

    appendSecurityAudit({
      eventType: 'CREW_SIMULATION_SESSION_ISSUED',
      actor: `SIM_${crewId}`,
      target: `crew/${crewId}`,
      outcome: 'ALLOWED',
      ip,
      details: `Issued HMAC-signed Simulation Crew session cookie for ${crewId}.`
    });

    res.json({
      ok: true,
      crewId: payload.crewId,
      role: payload.role,
      mode: payload.mode,
      sessionId: payload.sessionId
    });
  });

  // Verify server-signed Crew session (prevents browser state/URL spoofing)
  app.get('/api/auth/crew-session', (req: Request, res: Response) => {
    const cookies = parseCookies(req);
    const token = cookies['astroguard_crew_session'];
    if (!token) {
      res.status(401).json({ ok: false, error: 'No active crew session token.' });
      return;
    }

    const verified = verifySessionToken<SignedCrewSessionPayload>(token);
    if (!verified || !ALLOWED_CREW_IDS.has(verified.crewId) || verified.role !== 'ASTRONAUT') {
      clearHttpOnlyCookie(req, res, 'astroguard_crew_session');
      res.status(401).json({ ok: false, error: 'Invalid or expired crew session token.' });
      return;
    }

    res.json({
      ok: true,
      crewId: verified.crewId,
      role: verified.role,
      mode: verified.mode,
      sessionId: verified.sessionId
    });
  });

  app.post('/api/auth/logout', (req: Request, res: Response) => {
    const ip = getClientIp(req);
    clearHttpOnlyCookie(req, res, 'astroguard_crew_session');
    clearHttpOnlyCookie(req, res, 'astroguard_chief_session');
    appendSecurityAudit({
      eventType: 'SESSION_TERMINATED',
      actor: 'USER',
      target: 'portal/logout',
      outcome: 'ALLOWED',
      ip,
      details: 'Session cookies cleared.'
    });
    res.json({ ok: true });
  });

  // Vite dev middleware or production static assets
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[AstroGuard] Full-stack mission server listening on http://0.0.0.0:${PORT}`);
  });
}

void startServer();
