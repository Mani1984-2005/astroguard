#!/usr/bin/env node
/**
 * One-shot Express <-> Python health-engine integration test.
 *
 * Starts an isolated copy of the real Express server on an ephemeral port,
 * obtains a real signed crew session, invokes the real Python bridge through
 * /api/health/parameters and /api/health/analyze, validates the response, and
 * verifies invalid payload/auth handling. Only processes created by this test
 * are terminated.
 *
 * Run: npm run test:integration
 */

import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const GLOBAL_TIMEOUT_MS = Number(process.env.INTEGRATION_TIMEOUT_MS || 180_000);
const EXPRESS_READY_TIMEOUT_MS = 45_000;
const HTTP_TIMEOUT_MS = 45_000;
const CLEANUP_TIMEOUT_MS = 10_000;

const EXPECTED_DOMAINS = [
  'blood_pressure',
  'spo2',
  'body_temp',
  'sleep',
  'stress',
  'radiation',
  'muscle',
  'bone',
  'hydration',
  'nutrition',
  'heart_rate'
];

const validLogs = Array.from({ length: 7 }, (_, index) => ({
  day: index + 1,
  systolic: 118,
  diastolic: 74,
  spo2: 97.2,
  body_temp: 36.7,
  sleep_hours: 7.0,
  resting_hr: 62,
  heart_rate: 64,
  hrv_ms: 65,
  stress_self: 3,
  radiation_msv: 0.5,
  water_l: 2.4,
  calories_kcal: 2400,
  resist_min: 45,
  tread_min: 35,
  cycle_min: 20
}));

let serverChild = null;
let testPort = null;
let tempDir = null;
let pythonPid = null;
let expressOutput = [];
let cleanupPromise = null;
let cleanupResult = null;
const ownedProcesses = new Map();
const stages = [];

function info(message) {
  console.log(`[test] ${message}`);
}

function warning(message) {
  console.warn(`[test] WARNING: ${message}`);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function rememberOutput(stream, line) {
  const entry = `[express:${stream}] ${line}`;
  expressOutput.push(entry);
  if (expressOutput.length > 500) expressOutput.shift();
  console.log(entry);
}

function attachOutput(child) {
  for (const stream of ['stdout', 'stderr']) {
    let buffered = '';
    child[stream].setEncoding('utf8');
    child[stream].on('data', (chunk) => {
      buffered += chunk;
      let newline = buffered.indexOf('\n');
      while (newline >= 0) {
        const line = buffered.slice(0, newline).replace(/\r$/, '');
        buffered = buffered.slice(newline + 1);
        newline = buffered.indexOf('\n');
        if (line) rememberOutput(stream, line);
      }
    });
    child[stream].on('end', () => {
      if (buffered.trim()) rememberOutput(stream, buffered.trim());
      buffered = '';
    });
  }
}

async function stage(name, operation) {
  const started = performance.now();
  info(`${name} ...`);
  try {
    const value = await operation();
    const elapsedMs = Math.round(performance.now() - started);
    stages.push({ name, status: 'OK', elapsedMs });
    console.log(`[test] OK ${name} (${elapsedMs}ms)`);
    return value;
  } catch (error) {
    const elapsedMs = Math.round(performance.now() - started);
    const message = error instanceof Error ? error.message : String(error);
    stages.push({ name, status: 'FAIL', elapsedMs, error: message });
    console.error(`[test] FAIL ${name} (${elapsedMs}ms): ${message}`);
    if (error instanceof Error) {
      error.stage = name;
    }
    throw error;
  }
}

function getFreePort() {
  return new Promise((resolve, reject) => {
    const socket = net.createServer();
    socket.unref();
    socket.once('error', reject);
    socket.listen(0, '127.0.0.1', () => {
      const address = socket.address();
      const port = typeof address === 'object' && address ? address.port : 0;
      socket.close((error) => (error ? reject(error) : resolve(port)));
    });
  });
}

function httpRequest({
  port,
  requestPath,
  method = 'GET',
  headers = {},
  body,
  timeoutMs = HTTP_TIMEOUT_MS
}) {
  return new Promise((resolve, reject) => {
    const payload = body === undefined ? undefined : Buffer.from(JSON.stringify(body), 'utf8');
    const requestHeaders = {
      Connection: 'close',
      Accept: 'application/json',
      ...(payload
        ? {
            'Content-Type': 'application/json',
            'Content-Length': String(payload.length)
          }
        : {}),
      ...headers
    };

    const request = http.request(
      {
        hostname: '127.0.0.1',
        port,
        path: requestPath,
        method,
        headers: requestHeaders,
        agent: false
      },
      (response) => {
        const chunks = [];
        response.on('data', (chunk) => chunks.push(chunk));
        response.on('end', () => {
          const text = Buffer.concat(chunks).toString('utf8');
          let json = null;
          try {
            json = JSON.parse(text);
          } catch {
            // Non-JSON responses are reported by the caller using status/text.
          }
          resolve({
            status: response.statusCode ?? 0,
            headers: response.headers,
            text,
            json
          });
        });
      }
    );

    request.setTimeout(timeoutMs, () => {
      request.destroy(
        new Error(
          `HTTP ${method} ${requestPath} timed out after ${timeoutMs}ms on test port ${port}`
        )
      );
    });
    request.once('error', reject);
    if (payload) request.write(payload);
    request.end();
  });
}

function getProcessTable() {
  const script = [
    '[Console]::OutputEncoding = [System.Text.Encoding]::UTF8;',
    "$items = Get-CimInstance Win32_Process | ForEach-Object {",
    "  $created = '';",
    '  if ($_.CreationDate) { $created = $_.CreationDate.ToString("o") }',
    '  [pscustomobject]@{',
    '    ProcessId = [int]$_.ProcessId;',
    '    ParentProcessId = [int]$_.ParentProcessId;',
    '    Name = [string]$_.Name;',
    '    CreationDate = $created;',
    '    CommandLine = [string]$_.CommandLine',
    '  }',
    '};',
    '$items | ConvertTo-Json -Compress'
  ].join(' ');

  const result = spawnSync(
    'powershell.exe',
    ['-NoLogo', '-NoProfile', '-NonInteractive', '-Command', script],
    { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024, windowsHide: true }
  );

  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(
      `PowerShell process query failed (${result.status}): ${(result.stderr || '').trim()}`
    );
  }
  const text = (result.stdout || '').trim();
  if (!text) return [];
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    throw new Error(`Unable to parse PowerShell process table: ${error.message}`);
  }
  return Array.isArray(parsed) ? parsed : [parsed];
}

function descendantsOf(table, rootPid) {
  const byParent = new Map();
  for (const processInfo of table) {
    const key = String(processInfo.ParentProcessId);
    if (!byParent.has(key)) byParent.set(key, []);
    byParent.get(key).push(processInfo);
  }

  const result = [];
  const seen = new Set([Number(rootPid)]);
  const queue = [Number(rootPid)];
  while (queue.length > 0) {
    const parent = queue.shift();
    for (const child of byParent.get(String(parent)) || []) {
      if (seen.has(child.ProcessId)) continue;
      seen.add(child.ProcessId);
      result.push(child);
      queue.push(child.ProcessId);
    }
  }
  return result;
}

function refreshOwnedProcesses() {
  if (!serverChild?.pid) return { table: [], root: null, descendants: [] };
  const table = getProcessTable();
  const root = table.find((entry) => entry.ProcessId === serverChild.pid) ?? null;
  const descendants = descendantsOf(table, serverChild.pid);
  if (root) ownedProcesses.set(String(root.ProcessId), root);
  for (const entry of descendants) ownedProcesses.set(String(entry.ProcessId), entry);
  return { table, root, descendants };
}

function findPythonBridge(descendants) {
  return descendants.find(
    (entry) =>
      /python/i.test(entry.Name || '') &&
      /bridge\.py/i.test(entry.CommandLine || '')
  );
}

function processStillMatches(recording, current) {
  if (!current || current.ProcessId !== recording.ProcessId) return false;
  if (recording.Name && current.Name !== recording.Name) return false;
  if (recording.CreationDate && current.CreationDate !== recording.CreationDate) return false;
  return true;
}

function taskkill(pid) {
  const result = spawnSync('taskkill.exe', ['/PID', String(pid), '/T', '/F'], {
    encoding: 'utf8',
    windowsHide: true
  });
  if (result.error) throw result.error;
  const detail = `${(result.stdout || '').trim()} ${(result.stderr || '').trim()}`.trim();
  if (result.status !== 0) {
    const alreadyGone = /not found|no running instance|does not exist/i.test(detail);
    if (!alreadyGone) {
      throw new Error(`taskkill failed for test-owned PID ${pid}: ${detail}`);
    }
  }
}

function waitForChildExit(child, timeoutMs) {
  if (child.exitCode !== null) return Promise.resolve(true);
  return new Promise((resolve) => {
    let settled = false;
    let timer = null;
    const finish = (exited) => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      child.removeListener('exit', onExit);
      resolve(exited);
    };
    const onExit = () => finish(true);
    timer = setTimeout(() => finish(false), timeoutMs);
    child.once('exit', onExit);
  });
}

async function waitFor(check, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      if (await check()) return true;
    } catch {
      // Retry until the deadline; the caller reports the timeout.
    }
    await sleep(500);
  }
  return false;
}

async function cleanup(reason) {
  if (cleanupPromise) return cleanupPromise;
  cleanupPromise = (async () => {
    const started = performance.now();
    console.log(`[cleanup] start${reason ? ` (${reason})` : ''}`);
    const failures = [];

    try {
      if (serverChild?.pid) {
        try {
          refreshOwnedProcesses();
        } catch (error) {
          warning(`Could not refresh process tree before shutdown: ${error.message}`);
        }

        if (serverChild.exitCode === null) {
          console.log(`[cleanup] Sending SIGTERM to test-owned Express PID ${serverChild.pid}`);
          try {
            serverChild.kill('SIGTERM');
          } catch (error) {
            failures.push(`Unable to signal test Express: ${error.message}`);
          }
          const exited = await waitForChildExit(serverChild, 5_000);
          console.log(
            `[cleanup] Test Express PID ${serverChild.pid} ${exited ? 'exited' : 'still running after 5s'}`
          );
        } else {
          console.log(`[cleanup] Test Express already exited (code ${serverChild.exitCode})`);
        }
      }
    } catch (error) {
      failures.push(`Express shutdown check failed: ${error.message}`);
    }

    let table = [];
    try {
      table = getProcessTable();
    } catch (error) {
      failures.push(`Could not query processes during cleanup: ${error.message}`);
    }

    if (serverChild?.pid) {
      const currentRoot = table.find((entry) => entry.ProcessId === serverChild.pid);
      if (currentRoot) {
        console.log(
          `[cleanup] Force terminating remaining test-owned Express tree PID ${currentRoot.ProcessId}`
        );
        try {
          taskkill(currentRoot.ProcessId);
        } catch (error) {
          failures.push(error.message);
        }
      }
    }

    try {
      table = getProcessTable();
    } catch (error) {
      failures.push(`Could not re-query processes during cleanup: ${error.message}`);
    }

    for (const recording of ownedProcesses.values()) {
      if (recording.ProcessId === process.pid) continue;
      const current = table.find((entry) => entry.ProcessId === recording.ProcessId);
      if (!processStillMatches(recording, current)) continue;
      console.log(
        `[cleanup] Force terminating recorded test-owned ${recording.Name} PID ${recording.ProcessId}`
      );
      try {
        taskkill(recording.ProcessId);
      } catch (error) {
        failures.push(error.message);
      }
    }

    const ownedGone = await waitFor(() => {
      const currentTable = getProcessTable();
      return [...ownedProcesses.values()].every((recording) => {
        const current = currentTable.find((entry) => entry.ProcessId === recording.ProcessId);
        return !processStillMatches(recording, current);
      });
    }, CLEANUP_TIMEOUT_MS);

    if (!ownedGone) failures.push('Some test-owned processes did not exit before cleanup timeout');

    if (pythonPid) {
      let pythonAlive = true;
      try {
        const currentTable = getProcessTable();
        pythonAlive = currentTable.some((entry) => entry.ProcessId === pythonPid);
      } catch {
        pythonAlive = true;
      }
      console.log(`[cleanup] Python bridge PID ${pythonPid}: ${pythonAlive ? 'STILL ALIVE' : 'exited'}`);
      if (pythonAlive) failures.push(`Python bridge PID ${pythonPid} did not exit`);
    } else {
      console.log('[cleanup] Python bridge PID: not started or not detected');
    }

    if (tempDir) {
      try {
        fs.rmSync(tempDir, { recursive: true, force: true });
        console.log(`[cleanup] Removed isolated temp directory ${tempDir}`);
      } catch (error) {
        warning(`Could not remove temp directory ${tempDir}: ${error.message}`);
      }
    }

    const elapsedMs = Math.round(performance.now() - started);
    const ok = failures.length === 0;
    console.log(`[cleanup] ${ok ? 'PASS' : 'FAIL'} (${elapsedMs}ms)`);
    for (const failure of failures) console.error(`[cleanup] ${failure}`);
    cleanupResult = { ok, failures, elapsedMs };
    return cleanupResult;
  })();
  return cleanupPromise;
}

function startExpress(port) {
  const preflight = path.join(PROJECT_ROOT, 'node_modules', 'tsx', 'dist', 'preflight.cjs');
  const loaderPath = path.join(PROJECT_ROOT, 'node_modules', 'tsx', 'dist', 'loader.mjs');
  if (!fs.existsSync(preflight) || !fs.existsSync(loaderPath)) {
    throw new Error('tsx loader is not installed; run npm install first.');
  }

  const environment = {
    ...process.env,
    PORT: String(port),
    NODE_ENV: 'production',
    SESSION_HMAC_SECRET: crypto.randomBytes(32).toString('hex'),
    SESSION_REVOCATION_STORE: path.join(tempDir, 'revoked-sessions.json'),
    TEMP: tempDir,
    TMP: tempDir,
    PYTHON_EXECUTABLE: process.env.PYTHON_EXECUTABLE?.trim() || 'python'
  };
  delete environment.FIREBASE_SERVICE_ACCOUNT;
  delete environment.GOOGLE_APPLICATION_CREDENTIALS;

  const child = spawn(
    process.execPath,
    [
      '--require',
      preflight,
      '--import',
      pathToFileURL(loaderPath).href,
      'server.ts'
    ],
    {
      cwd: PROJECT_ROOT,
      env: environment,
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true
    }
  );
  attachOutput(child);
  return child;
}

async function waitForExpress(port) {
  const deadline = Date.now() + EXPRESS_READY_TIMEOUT_MS;
  let lastError = null;
  while (Date.now() < deadline) {
    if (serverChild.exitCode !== null) {
      throw new Error(
        `Express test server exited before readiness (code ${serverChild.exitCode}).`
      );
    }
    try {
      const response = await httpRequest({
        port,
        requestPath: '/api/auth/status',
        timeoutMs: 3_000
      });
      if (response.status === 200) {
        return response;
      }
      lastError = new Error(`Readiness returned HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    await sleep(250);
  }
  throw new Error(
    `Express did not become ready within ${EXPRESS_READY_TIMEOUT_MS}ms: ${lastError?.message || 'no response'}`
  );
}

function extractCrewCookie(headers) {
  const raw = headers['set-cookie'];
  const cookies = Array.isArray(raw) ? raw : raw ? [raw] : [];
  for (const cookie of cookies) {
    const pair = cookie.split(';')[0];
    if (pair.startsWith('astroguard_crew_session=')) return pair;
  }
  throw new Error('Express did not return an astroguard_crew_session cookie.');
}

function validateParametersResponse(response) {
  assert.equal(response.status, 200, `parameters HTTP ${response.status}: ${response.text}`);
  assert.equal(response.json?.ok, true, `parameters ok=false: ${response.text}`);
  assert.equal(
    Object.keys(response.json?.parameters || {}).length,
    EXPECTED_DOMAINS.length,
    'unexpected Python parameter-definition count'
  );
  assert.equal(typeof response.json?.readiness, 'object', 'parameters readiness metadata missing');
  assert.equal(
    typeof response.json?.disclaimer,
    'string',
    'parameters disclaimer missing from the Python engine response'
  );
}

function validateAnalyzeResponse(response) {
  assert.equal(response.status, 200, `analyze HTTP ${response.status}: ${response.text}`);
  assert.equal(response.json?.ok, true, `analyze ok=false: ${response.text}`);
  assert.equal(response.json?.crewId, 'AG-LEO-01', 'analyze returned the wrong crewId');
  assert.equal(response.json?.actorRole, 'ASTRONAUT', 'analyze returned the wrong actor role');

  const report = response.json?.report;
  assert.ok(report && typeof report === 'object', 'analyze report missing');
  assert.equal(report.engine, 'python', 'report.engine must identify the Python engine');
  assert.equal(report.is_simulated, true, 'report must be marked simulated');
  assert.equal(report.crew_id, 'AG-LEO-01', 'report.crew_id mismatch');
  assert.equal(typeof report.readiness, 'number', 'report.readiness must be numeric');
  assert.ok(report.readiness >= 0 && report.readiness <= 100, 'report.readiness out of range');
  assert.ok(
    ['FINE', 'CAUTION', 'DANGER', 'NO SIGNAL'].includes(report.condition),
    `unexpected report.condition ${report.condition}`
  );
  assert.ok(
    ['NORMAL', 'WATCH', 'ALERT', 'LIMITED_DATA', 'INSUFFICIENT_DATA'].includes(
      report.overall_status
    ),
    `unexpected report.overall_status ${report.overall_status}`
  );
  assert.deepEqual(
    Object.keys(report.domains || {}).sort(),
    [...EXPECTED_DOMAINS].sort(),
    'report domains do not match the eleven expected health domains'
  );
  assert.equal(
    Object.keys(report.parameter_definitions || {}).length,
    EXPECTED_DOMAINS.length,
    'report parameter definitions are incomplete'
  );
  assert.ok(report.data_quality && report.data_quality.validation, 'data-quality metadata missing');
  assert.ok(Array.isArray(report.countermeasures), 'countermeasures must be an array');
  assert.equal(typeof report.model_disclaimer, 'string', 'model disclaimer missing');
}

async function run() {
  testPort = await getFreePort();
  if (testPort === 3000) throw new Error('Allocated port unexpectedly matched the dev server port 3000.');
  info(`Isolated Express test port: ${testPort}`);

  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'astroguard-integration-'));
  info(`Isolated temp directory: ${tempDir}`);

  serverChild = await stage('spawn isolated Express server', () =>
    Promise.resolve(startExpress(testPort))
  );
  info(`Test-owned Express PID: ${serverChild.pid}`);

  await stage('wait for Express HTTP readiness', () => waitForExpress(testPort));

  const beforePython = await stage('record pre-Python process tree', () =>
    Promise.resolve(refreshOwnedProcesses())
  );
  assert.equal(
    findPythonBridge(beforePython.descendants),
    undefined,
    'Python bridge started before any health request'
  );

  const crewSession = await stage('authenticate through /api/auth/crew-session', () =>
    httpRequest({
      port: testPort,
      requestPath: '/api/auth/crew-session',
      method: 'POST',
      body: { crewId: 'AG-LEO-01' }
    })
  );
  assert.equal(crewSession.status, 200, `crew-session HTTP ${crewSession.status}: ${crewSession.text}`);
  assert.equal(crewSession.json?.ok, true, `crew-session ok=false: ${crewSession.text}`);
  assert.equal(crewSession.json?.crewId, 'AG-LEO-01', 'crew-session returned the wrong crewId');
  const crewCookie = extractCrewCookie(crewSession.headers);
  info('Signed crew-session cookie received.');

  const parameters = await stage('start Python bridge through /api/health/parameters', () =>
    httpRequest({
      port: testPort,
      requestPath: '/api/health/parameters',
      headers: { Cookie: crewCookie }
    })
  );
  validateParametersResponse(parameters);
  info(
    `Python parameters response validated: ${Object.keys(parameters.json.parameters).length} domains.`
  );

  const pythonProcess = await stage('detect real Python bridge child process', () => {
    const { descendants } = refreshOwnedProcesses();
    const found = findPythonBridge(descendants);
    if (!found) {
      throw new Error('No python bridge.py child process was found under the test Express process.');
    }
    pythonPid = found.ProcessId;
    info(`Python bridge PID: ${pythonPid}`);
    info(`Python command: ${(found.CommandLine || '').slice(0, 240)}`);
    return found;
  });

  const analysis = await stage('real /api/health/analyze round-trip', () =>
    httpRequest({
      port: testPort,
      requestPath: '/api/health/analyze',
      method: 'POST',
      headers: { Cookie: crewCookie },
      body: {
        crewId: 'AG-LEO-01',
        logs: validLogs,
        priorCareerMsv: 0,
        countermeasureStatus: { hydration: true, sleep: true }
      }
    })
  );
  validateAnalyzeResponse(analysis);
  info(
    `Analysis validated: condition=${analysis.json.report.condition}, readiness=${analysis.json.report.readiness}, actorRole=${analysis.json.actorRole}.`
  );

  await stage('authorization and invalid-payload handling', async () => {
    const unauthenticated = await httpRequest({
      port: testPort,
      requestPath: '/api/health/analyze',
      method: 'POST',
      body: { crewId: 'AG-LEO-01', logs: validLogs }
    });
    assert.equal(
      unauthenticated.status,
      401,
      `unauthenticated analyze should be 401, got ${unauthenticated.status}`
    );
    assert.equal(unauthenticated.json?.ok, false, 'unauthenticated analyze must not succeed');

    const crossCrew = await httpRequest({
      port: testPort,
      requestPath: '/api/health/analyze',
      method: 'POST',
      headers: { Cookie: crewCookie },
      body: { crewId: 'AG-LEO-02', logs: validLogs }
    });
    assert.equal(
      crossCrew.status,
      403,
      `cross-crew analyze should be 403, got ${crossCrew.status}`
    );

    const shortPayload = await httpRequest({
      port: testPort,
      requestPath: '/api/health/analyze',
      method: 'POST',
      headers: { Cookie: crewCookie },
      body: { crewId: 'AG-LEO-01', logs: validLogs.slice(0, 2) }
    });
    assert.equal(
      shortPayload.status,
      400,
      `short analyze payload should be 400, got ${shortPayload.status}`
    );

    const stillHealthy = await httpRequest({
      port: testPort,
      requestPath: '/api/health/parameters',
      headers: { Cookie: crewCookie }
    });
    validateParametersResponse(stillHealthy);
    info('Rejected requests did not break the live Python bridge.');
  });

  await stage('session revocation invalidates the old cookie', async () => {
    const beforeLogout = await httpRequest({
      port: testPort,
      requestPath: '/api/auth/crew-session',
      headers: { Cookie: crewCookie }
    });
    assert.equal(beforeLogout.status, 200, 'crew session should be valid before logout');
    const oldSessionId = beforeLogout.json?.sessionId;
    assert.equal(typeof oldSessionId, 'string', 'crew session ID missing before logout');

    const logout = await httpRequest({
      port: testPort,
      requestPath: '/api/auth/logout',
      method: 'POST',
      headers: { Cookie: crewCookie }
    });
    assert.equal(logout.status, 200, `logout HTTP ${logout.status}: ${logout.text}`);

    const reusedCookie = await httpRequest({
      port: testPort,
      requestPath: '/api/auth/crew-session',
      headers: { Cookie: crewCookie }
    });
    assert.equal(reusedCookie.status, 401, 'revoked crew session cookie must be rejected');

    const rejectedBridgeCall = await httpRequest({
      port: testPort,
      requestPath: '/api/health/parameters',
      headers: { Cookie: crewCookie }
    });
    assert.equal(rejectedBridgeCall.status, 401, 'revoked cookie must not reach the Python bridge');

    const newSession = await httpRequest({
      port: testPort,
      requestPath: '/api/auth/crew-session',
      method: 'POST',
      body: { crewId: 'AG-LEO-01' }
    });
    assert.equal(newSession.status, 200, `new crew session HTTP ${newSession.status}`);
    assert.notEqual(newSession.json?.sessionId, oldSessionId, 'new login reused the revoked session ID');
    info('Revoked cookie rejected; a new login issued a distinct session.');
  });

  return {
    port: testPort,
    expressPid: serverChild.pid,
    pythonPid,
    pythonCommand: pythonProcess.CommandLine,
    condition: analysis.json.report.condition,
    readiness: analysis.json.report.readiness,
    domains: Object.keys(analysis.json.report.domains).length
  };
}

function printDiagnostics(failure) {
  console.log('\n=== Express-Python integration diagnostics ===');
  console.log(`Project root: ${PROJECT_ROOT}`);
  console.log(`Test Express port: ${testPort ?? '(not allocated)'}`);
  console.log(`Test-owned Express PID: ${serverChild?.pid ?? '(not started)'}`);
  console.log(`Python bridge PID: ${pythonPid ?? '(not detected)'}`);
  for (const entry of stages) {
    const detail = entry.status === 'OK' ? '' : `: ${entry.error}`;
    console.log(
      `  ${entry.status.padEnd(4)} ${entry.name} (${entry.elapsedMs}ms)${detail}`
    );
  }
  console.log(`Captured Express/Python stdout+stderr lines: ${expressOutput.length}`);
  if (failure) {
    console.error(
      `First failure: ${failure.stage ? `${failure.stage} - ` : ''}${failure.message}`
    );
  }
}

async function main() {
  let failure = null;
  let timeoutHandle = null;

  const timeout = new Promise((_, reject) => {
    timeoutHandle = setTimeout(() => {
      reject(
        new Error(
          `Global integration timeout after ${GLOBAL_TIMEOUT_MS}ms. ` +
            `Active stage: ${stages.length > 0 ? stages[stages.length - 1].name : 'startup'}`
        )
      );
    }, GLOBAL_TIMEOUT_MS);
  });

  try {
    await Promise.race([run(), timeout]);
  } catch (error) {
    failure = error instanceof Error ? error : new Error(String(error));
    console.error(`[test] Integration failure: ${failure.message}`);
  } finally {
    if (timeoutHandle) clearTimeout(timeoutHandle);
  }

  const cleanupStatus = await cleanup(failure ? 'test failure' : 'test completion');
  printDiagnostics(failure);

  if (failure) {
    console.error('\nRESULT: FAIL');
    return 1;
  }
  if (!cleanupStatus.ok) {
    console.error('\nRESULT: FAIL (cleanup incomplete)');
    return 1;
  }
  console.log('\nRESULT: PASS');
  return 0;
}

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.once(signal, () => {
    console.error(`[test] Received ${signal}; cleaning up test-owned processes.`);
    void cleanup(signal).finally(() => process.exit(130));
  });
}

main()
  .then((code) => {
    process.exitCode = code;
  })
  .catch(async (error) => {
    console.error(`[test] Unhandled failure: ${error?.stack || error}`);
    await cleanup('unhandled failure');
    process.exitCode = 1;
  });
