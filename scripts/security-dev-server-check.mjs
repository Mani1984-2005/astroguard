#!/usr/bin/env node
/**
 * Dev-server filesystem exposure regression test.
 *
 * Starts an isolated dev-mode Express/Vite server on loopback, verifies that
 * sensitive project files are not reachable through direct paths, /@fs/ paths,
 * encoded paths, or traversal variants, and confirms normal frontend assets
 * still load. Only the server process created by this test is terminated.
 *
 * Run: npm run test:security
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
const READY_TIMEOUT_MS = 60_000;
const HTTP_TIMEOUT_MS = 15_000;
const ROOT = PROJECT_ROOT.replace(/\\/g, '/');
const SENSITIVE_PATHS = [
  `/@fs/${ROOT}/server-data/session-hmac.key`,
  `/@fs/${ROOT}/server-data/%73ession-hmac.key`,
  `/@fs/${ROOT}/server-data%2Fsession-hmac.key`,
  `/@fs/${ROOT}/server-data/../server-data/session-hmac.key`,
  `/@fs/${ROOT}/scripts%2F..%2Fserver-data%2Fsession-hmac.key`,
  `/@fs/${ROOT}/firestore.rules`,
  `/@fs/C:%2FUsers%2Fhello%2Fastroguard%2Ffirestore.rules`,
  `/%40fs/${ROOT}/python_engine/bridge.py`,
  `/@fs/${ROOT}/python_engine/bridge.py`,
  `/@fs/${ROOT}/scripts/integration-express-python.mjs`,
  `/server-data/session-hmac.key`,
  `/python_engine/bridge.py`,
  `/firestore.rules`,
  `/%2e%2e/server-data/session-hmac.key`
];
const LEGITIMATE_PATHS = [
  '/',
  '/api/auth/status',
  '/src/main.tsx',
  '/src/index.css',
  '/assets/crew/cmd-001-elena-vance.jpg'
];

let child = null;
let port = null;
let tempDir = null;
let output = [];

function log(message) {
  console.log(`[security] ${message}`);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function remember(stream, line) {
  output.push(`[${stream}] ${line}`);
  if (output.length > 300) output.shift();
}

function attachOutput(processHandle) {
  for (const stream of ['stdout', 'stderr']) {
    let buffered = '';
    processHandle[stream].setEncoding('utf8');
    processHandle[stream].on('data', (chunk) => {
      buffered += chunk;
      let newline = buffered.indexOf('\n');
      while (newline >= 0) {
        const line = buffered.slice(0, newline).replace(/\r$/, '');
        buffered = buffered.slice(newline + 1);
        newline = buffered.indexOf('\n');
        if (line) remember(stream, line);
      }
    });
    processHandle[stream].on('end', () => {
      if (buffered.trim()) remember(stream, buffered.trim());
      buffered = '';
    });
  }
}

function getFreePort() {
  return new Promise((resolve, reject) => {
    const socket = net.createServer();
    socket.unref();
    socket.once('error', reject);
    socket.listen(0, '127.0.0.1', () => {
      const address = socket.address();
      const allocated = typeof address === 'object' && address ? address.port : 0;
      socket.close((error) => (error ? reject(error) : resolve(allocated)));
    });
  });
}

function request(requestPath, options = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port,
        path: requestPath,
        method: options.method || 'GET',
        agent: false,
        headers: {
          Connection: 'close',
          Accept: '*/*',
          ...(options.headers || {})
        }
      },
      (response) => {
        const chunks = [];
        response.on('data', (chunk) => chunks.push(chunk));
        response.on('end', () => {
          resolve({
            status: response.statusCode ?? 0,
            headers: response.headers,
            bytes: Buffer.concat(chunks).length
          });
        });
      }
    );
    req.setTimeout(HTTP_TIMEOUT_MS, () => {
      req.destroy(new Error(`Request timed out: ${requestPath}`));
    });
    req.once('error', reject);
    req.end();
  });
}

async function waitForReady() {
  const deadline = Date.now() + READY_TIMEOUT_MS;
  let lastError = null;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`Dev server exited before readiness (code ${child.exitCode}).`);
    }
    try {
      const response = await request('/api/auth/status');
      if (response.status === 200) return;
      lastError = new Error(`Readiness HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    await sleep(300);
  }
  throw new Error(`Dev server did not become ready: ${lastError?.message || 'timeout'}`);
}

function firstExternalIpv4() {
  for (const entries of Object.values(os.networkInterfaces())) {
    for (const entry of entries || []) {
      if (entry.family === 'IPv4' && !entry.internal) return entry.address;
    }
  }
  return null;
}

function canConnect(host, targetPort) {
  return new Promise((resolve) => {
    const socket = net.connect({ host, port: targetPort });
    const finish = (connected) => {
      socket.removeAllListeners();
      socket.destroy();
      resolve(connected);
    };
    socket.setTimeout(1_500, () => finish(false));
    socket.once('connect', () => finish(true));
    socket.once('error', () => finish(false));
  });
}

function killTree(pid) {
  if (!pid) return;
  if (process.platform === 'win32') {
    spawnSync('taskkill.exe', ['/PID', String(pid), '/T', '/F'], {
      encoding: 'utf8',
      windowsHide: true
    });
  } else {
    try {
      process.kill(pid, 'SIGTERM');
    } catch {
      // Already gone.
    }
  }
}

async function cleanup() {
  if (child && child.exitCode === null) {
    killTree(child.pid);
    const deadline = Date.now() + 5_000;
    while (Date.now() < deadline && child.exitCode === null) {
      await sleep(100);
    }
  }
  if (tempDir) {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // Best-effort cleanup only.
    }
  }
}

function startServer() {
  const preflight = path.join(PROJECT_ROOT, 'node_modules', 'tsx', 'dist', 'preflight.cjs');
  const loaderPath = path.join(PROJECT_ROOT, 'node_modules', 'tsx', 'dist', 'loader.mjs');
  if (!fs.existsSync(preflight) || !fs.existsSync(loaderPath)) {
    throw new Error('tsx loader is not installed; run npm install first.');
  }

  const environment = {
    ...process.env,
    PORT: String(port),
    HOST: '127.0.0.1',
    NODE_ENV: 'development',
    DISABLE_HMR: 'true',
    SESSION_HMAC_SECRET: crypto.randomBytes(32).toString('hex'),
    SESSION_REVOCATION_STORE: path.join(tempDir, 'revoked-sessions.json'),
    TEMP: tempDir,
    TMP: tempDir
  };
  delete environment.FIREBASE_SERVICE_ACCOUNT;
  delete environment.GOOGLE_APPLICATION_CREDENTIALS;

  const processHandle = spawn(
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
  attachOutput(processHandle);
  return processHandle;
}

async function main() {
  port = await getFreePort();
  if (port === 3000) throw new Error('Allocated test port unexpectedly matched 3000.');
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'astroguard-security-'));
  log(`Isolated dev server port ${port}; process output is captured locally.`);

  child = startServer();
  await waitForReady();
  log(`Dev server ready (PID ${child.pid}).`);

  for (const requestPath of SENSITIVE_PATHS) {
    const response = await request(requestPath);
    assert.ok(
      response.status === 403 || response.status === 404,
      `Sensitive path was not blocked (status ${response.status}, ${response.bytes} bytes): ${requestPath}`
    );
    log(`BLOCKED ${response.status} ${requestPath}`);
  }

  for (const requestPath of LEGITIMATE_PATHS) {
    const response = await request(requestPath);
    assert.equal(response.status, 200, `Legitimate path failed (${response.status}): ${requestPath}`);
    assert.ok(response.bytes > 0, `Legitimate path returned an empty body: ${requestPath}`);
    log(`OK 200 ${requestPath}`);
  }

  const hardened = await request('/');
  assert.equal(hardened.headers['x-powered-by'], undefined, 'X-Powered-By must not be exposed');
  assert.equal(hardened.headers['x-content-type-options'], 'nosniff');
  assert.equal(hardened.headers['x-frame-options'], 'DENY');
  assert.equal(hardened.headers['referrer-policy'], 'no-referrer');
  assert.match(hardened.headers['content-security-policy'] || '', /frame-ancestors 'none'/);
  assert.match(
    hardened.headers['content-security-policy-report-only'] || '',
    /default-src 'self'/
  );
  log('OK security headers present');

  const crossOrigin = await request('/api/auth/logout', {
    method: 'POST',
    headers: { Origin: 'https://evil.example' }
  });
  assert.equal(crossOrigin.status, 403, 'Cross-origin POST was not rejected.');
  log('BLOCKED 403 cross-origin POST /api/auth/logout');

  const crossSiteFetch = await request('/api/auth/logout', {
    method: 'POST',
    headers: { Origin: `http://127.0.0.1:${port}`, 'Sec-Fetch-Site': 'cross-site' }
  });
  assert.equal(crossSiteFetch.status, 403, 'Cross-site fetch metadata was not rejected.');
  log('BLOCKED 403 Sec-Fetch-Site cross-site POST');

  const sameOrigin = await request('/api/auth/logout', {
    method: 'POST',
    headers: { Origin: `http://127.0.0.1:${port}` }
  });
  assert.equal(sameOrigin.status, 200, 'Same-origin POST was rejected.');
  log('OK 200 same-origin POST /api/auth/logout');

  const noOrigin = await request('/api/auth/logout', { method: 'POST' });
  assert.equal(noOrigin.status, 200, 'Non-browser POST without Origin was rejected.');
  log('OK 200 non-browser POST without Origin');

  const externalIp = firstExternalIpv4();
  if (externalIp) {
    const reachable = await canConnect(externalIp, port);
    assert.equal(
      reachable,
      false,
      `Dev server is reachable on external interface ${externalIp}:${port}`
    );
    log(`NOT REACHABLE via external interface ${externalIp}:${port}`);
  } else {
    log('No external IPv4 interface found; external-binding check skipped.');
  }

  log('RESULT: PASS');
}

let exitCode = 0;
try {
  await main();
} catch (error) {
  exitCode = 1;
  console.error(`[security] RESULT: FAIL: ${error instanceof Error ? error.message : String(error)}`);
  if (output.length) {
    console.error('[security] Captured server output:');
    for (const line of output.slice(-30)) console.error(line);
  }
} finally {
  await cleanup();
}

process.exitCode = exitCode;
