#!/usr/bin/env node
/**
 * Forced Python-bridge timeout recovery test.
 *
 * Starts an isolated Express server with a temporary stub bridge. The first
 * stub worker deliberately hangs; the server must reject the request, terminate
 * that worker, and start a replacement worker that answers subsequent requests.
 *
 * Run: npm run test:bridge-timeout
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
const READY_TIMEOUT_MS = 45_000;
const REQUEST_TIMEOUT_MS = 15_000;
const BRIDGE_TIMEOUT_MS = 700;

const STUB_SOURCE = String.raw`
import json
import os
import pathlib
import sys
import time

marker = pathlib.Path(os.environ["BRIDGE_HANG_MARKER"])
pid_file = pathlib.Path(os.environ["BRIDGE_PID_FILE"])

with pid_file.open("a", encoding="utf-8") as handle:
    handle.write(str(os.getpid()) + "\n")
    handle.flush()

print(json.dumps({"ready": True, "engine": "timeout-stub"}), flush=True)

for line in sys.stdin:
    line = line.strip()
    if not line:
        continue
    try:
        request = json.loads(line)
    except Exception:
        continue

    if not marker.exists():
        marker.write_text(str(os.getpid()), encoding="utf-8")
        time.sleep(120)
        continue

    result = {
        "parameters": {f"domain_{index}": {"label": f"Domain {index}"} for index in range(11)},
        "readiness": {},
        "disclaimer": "timeout recovery stub"
    }
    print(json.dumps({"id": request.get("id"), "ok": True, "result": result}), flush=True)
`;

let serverChild = null;
let testPort = null;
let tempDir = null;
let markerPath = null;
let pidFilePath = null;
let cleanupStarted = false;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function info(message) {
  console.log(`[bridge-timeout] ${message}`);
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

function httpRequest({ port, requestPath, method = 'GET', headers = {}, body }) {
  return new Promise((resolve, reject) => {
    const payload = body === undefined ? undefined : Buffer.from(JSON.stringify(body), 'utf8');
    const request = http.request(
      {
        hostname: '127.0.0.1',
        port,
        path: requestPath,
        method,
        agent: false,
        headers: {
          Connection: 'close',
          Accept: 'application/json',
          ...(payload
            ? {
                'Content-Type': 'application/json',
                'Content-Length': String(payload.length)
              }
            : {}),
          ...headers
        }
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
            // The caller reports non-JSON responses using status/text.
          }
          resolve({ status: response.statusCode ?? 0, headers: response.headers, text, json });
        });
      }
    );
    request.setTimeout(REQUEST_TIMEOUT_MS, () => {
      request.destroy(new Error(`HTTP ${method} ${requestPath} timed out`));
    });
    request.once('error', reject);
    if (payload) request.write(payload);
    request.end();
  });
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

function readStubPids() {
  if (!pidFilePath || !fs.existsSync(pidFilePath)) return [];
  return fs
    .readFileSync(pidFilePath, 'utf8')
    .split(/\r?\n/)
    .map((line) => Number.parseInt(line.trim(), 10))
    .filter((pid) => Number.isInteger(pid) && pid > 0);
}

function pidExists(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

async function waitForPidExit(pid, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (!pidExists(pid)) return true;
    await sleep(100);
  }
  return !pidExists(pid);
}

function taskkill(pid) {
  const result = spawnSync('taskkill.exe', ['/PID', String(pid), '/T', '/F'], {
    encoding: 'utf8',
    windowsHide: true
  });
  if (result.error) return result.error.message;
  if (result.status === 0) return null;
  const detail = `${result.stdout || ''} ${result.stderr || ''}`.trim();
  if (/not found|no running instance|does not exist/i.test(detail)) return null;
  return detail || `taskkill exited ${result.status}`;
}

function startExpress(port, stubPath) {
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
    PYTHON_BRIDGE_SCRIPT: stubPath,
    PYTHON_BRIDGE_REQUEST_TIMEOUT_MS: String(BRIDGE_TIMEOUT_MS),
    PYTHON_BRIDGE_STARTUP_TIMEOUT_MS: '10000',
    BRIDGE_HANG_MARKER: markerPath,
    BRIDGE_PID_FILE: pidFilePath
  };
  delete environment.FIREBASE_SERVICE_ACCOUNT;
  delete environment.GOOGLE_APPLICATION_CREDENTIALS;

  return spawn(
    process.execPath,
    ['--require', preflight, '--import', pathToFileURL(loaderPath).href, 'server.ts'],
    {
      cwd: PROJECT_ROOT,
      env: environment,
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true
    }
  );
}

function attachServerOutput(child) {
  for (const stream of ['stdout', 'stderr']) {
    let buffered = '';
    child[stream].setEncoding('utf8');
    child[stream].on('data', (chunk) => {
      buffered += chunk;
      let newline = buffered.indexOf('\n');
      while (newline >= 0) {
        const line = buffered.slice(0, newline).trim();
        buffered = buffered.slice(newline + 1);
        newline = buffered.indexOf('\n');
        if (line) console.log(`[express:${stream}] ${line}`);
      }
    });
  }
}

async function waitForExpress(port) {
  const deadline = Date.now() + READY_TIMEOUT_MS;
  let lastError = null;
  while (Date.now() < deadline) {
    if (serverChild.exitCode !== null) {
      throw new Error(`Express exited before readiness (code ${serverChild.exitCode}).`);
    }
    try {
      const response = await httpRequest({ port, requestPath: '/api/auth/status' });
      if (response.status === 200) return;
      lastError = new Error(`Readiness returned HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    await sleep(250);
  }
  throw new Error(
    `Express did not become ready within ${READY_TIMEOUT_MS}ms: ${lastError?.message || 'no response'}`
  );
}

async function cleanup() {
  if (cleanupStarted) return;
  cleanupStarted = true;

  const failures = [];
  const stubPids = readStubPids();

  if (serverChild?.pid) {
    try {
      serverChild.kill('SIGTERM');
    } catch {
      // Best effort; taskkill below handles the remaining tree.
    }
    await sleep(500);
    if (serverChild.exitCode === null) {
      const error = taskkill(serverChild.pid);
      if (error) failures.push(`Express cleanup failed: ${error}`);
    }
  }

  for (const pid of stubPids) {
    if (pid === process.pid || !pidExists(pid)) continue;
    const error = taskkill(pid);
    if (error) failures.push(`Stub bridge PID ${pid} cleanup failed: ${error}`);
  }

  if (tempDir) {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch (error) {
      failures.push(`Temp directory cleanup failed: ${error.message}`);
    }
  }

  if (failures.length > 0) {
    for (const failure of failures) console.error(`[cleanup] ${failure}`);
    throw new Error('Cleanup incomplete.');
  }
  info('Cleanup complete.');
}

async function run() {
  testPort = await getFreePort();
  if (testPort === 3000) throw new Error('Allocated port unexpectedly matched port 3000.');

  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'astroguard-bridge-timeout-'));
  markerPath = path.join(tempDir, 'hung-once.marker');
  pidFilePath = path.join(tempDir, 'stub-pids.txt');
  const stubPath = path.join(tempDir, 'bridge_stub.py');
  fs.writeFileSync(stubPath, STUB_SOURCE.trimStart(), 'utf8');

  info(`Isolated Express port ${testPort}; stub ${stubPath}`);
  serverChild = startExpress(testPort, stubPath);
  attachServerOutput(serverChild);
  info(`Test-owned Express PID ${serverChild.pid}`);

  await waitForExpress(testPort);

  const crewSession = await httpRequest({
    port: testPort,
    requestPath: '/api/auth/crew-session',
    method: 'POST',
    body: { crewId: 'AG-LEO-01' }
  });
  assert.equal(crewSession.status, 200, `crew-session HTTP ${crewSession.status}: ${crewSession.text}`);
  const crewCookie = extractCrewCookie(crewSession.headers);

  const started = performance.now();
  const timedOut = await httpRequest({
    port: testPort,
    requestPath: '/api/health/parameters',
    headers: { Cookie: crewCookie }
  });
  const elapsedMs = Math.round(performance.now() - started);

  assert.equal(timedOut.status, 503, `hung request should be 503, got ${timedOut.status}`);
  assert.equal(timedOut.json?.ok, false, 'hung request must not report success');
  assert.match(
    timedOut.json?.detail || '',
    /timed out;\s*worker restarted/i,
    `unexpected timeout detail: ${timedOut.json?.detail}`
  );
  assert.ok(elapsedMs >= BRIDGE_TIMEOUT_MS - 100, `timeout returned too early (${elapsedMs}ms)`);
  info(`Hung request rejected after ${elapsedMs}ms.`);

  await sleep(250);
  const firstPids = readStubPids();
  assert.ok(firstPids.length >= 1, 'stub bridge PID was not recorded');
  const firstPid = firstPids[0];
  assert.ok(
    await waitForPidExit(firstPid, 3_000),
    `timed-out stub bridge PID ${firstPid} is still alive`
  );
  info(`Timed-out stub bridge PID ${firstPid} terminated.`);

  const replacement = await httpRequest({
    port: testPort,
    requestPath: '/api/health/parameters',
    headers: { Cookie: crewCookie }
  });
  assert.equal(replacement.status, 200, `replacement request HTTP ${replacement.status}: ${replacement.text}`);
  assert.equal(replacement.json?.ok, true, `replacement ok=false: ${replacement.text}`);
  assert.equal(Object.keys(replacement.json?.parameters || {}).length, 11);
  assert.equal(replacement.json?.disclaimer, 'timeout recovery stub');

  const pids = readStubPids();
  assert.ok(pids.length >= 2, `expected a replacement stub, recorded PIDs: ${pids.join(', ')}`);
  assert.notEqual(pids[1], firstPid, 'replacement bridge reused the timed-out PID');
  info(`Replacement stub bridge PID ${pids[1]} answered successfully.`);

  const stable = await httpRequest({
    port: testPort,
    requestPath: '/api/health/parameters',
    headers: { Cookie: crewCookie }
  });
  assert.equal(stable.status, 200, `stable request HTTP ${stable.status}: ${stable.text}`);
  info('Subsequent request remained healthy.');
}

let failure = null;
try {
  await run();
} catch (error) {
  failure = error instanceof Error ? error : new Error(String(error));
  console.error(`[bridge-timeout] FAIL: ${failure.message}`);
} finally {
  try {
    await cleanup();
  } catch (error) {
    failure = failure || (error instanceof Error ? error : new Error(String(error)));
    console.error(`[bridge-timeout] ${error.message}`);
  }
}

if (failure) {
  console.error('\nRESULT: FAIL');
  process.exitCode = 1;
} else {
  console.log('\nRESULT: PASS');
}
