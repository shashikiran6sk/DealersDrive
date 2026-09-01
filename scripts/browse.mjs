#!/usr/bin/env node
/**
 * A minimal Chrome DevTools Protocol driver for visual QA (CLAUDE.md §28).
 *
 * Playwright is not a dependency of this product and should not become one for
 * the sake of screenshots, so this speaks CDP directly over Node's built-in
 * WebSocket: launch headless Chrome, run a short script of steps, capture a
 * full-page PNG.
 *
 *   node scripts/browse.mjs <url> <out.png> [--width=1440] [--steps=steps.json]
 *                                            [--cookie=name=value]
 *
 * `--cookie` is set through the DevTools protocol rather than `document.cookie`,
 * which is the only way to hand the page a session: the real `dd_session` is
 * HttpOnly, and script cannot write one — nor should it be able to.
 *
 * A step is one of:
 *   { "eval": "<expression>" }        run in the page, await the result
 *   { "wait": 500 }                   sleep, milliseconds
 *   { "shot": "path.png" }            capture now, mid-script
 */
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

const [url, out, ...flags] = process.argv.slice(2);
if (!url || !out) {
  console.error('usage: browse.mjs <url> <out.png> [--width=1440] [--steps=steps.json]');
  process.exit(2);
}
const flag = (name, fallback) =>
  flags
    .find((f) => f.startsWith(`--${name}=`))
    ?.split('=')
    .slice(1)
    .join('=') ?? fallback;

const width = Number(flag('width', '1440'));
const stepsFile = flag('steps', null);
const cookies = flags
  .filter((f) => f.startsWith('--cookie='))
  .map((f) => f.slice('--cookie='.length));
const steps = stepsFile ? JSON.parse(await readFile(stepsFile, 'utf8')) : [];

const profile = await mkdtemp(join(tmpdir(), 'dd-cdp-'));
const chrome = spawn(CHROME, [
  '--headless=new',
  '--disable-gpu',
  '--remote-debugging-port=9222',
  `--user-data-dir=${profile}`,
  `--window-size=${width},1000`,
  '--hide-scrollbars',
  '--no-first-run',
  'about:blank',
]);
chrome.stderr.on('data', () => {});

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function target() {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      // Chrome's DevTools Protocol endpoint is plain HTTP on loopback by
      // design; there is no TLS to opt into. The suppression names the rule,
      // and it has to sit on the line directly above the finding.
      // nosemgrep: typescript.react.security.react-insecure-request.react-insecure-request
      const list = await fetch('http://127.0.0.1:9222/json/list').then((r) => r.json());
      const page = list.find((t) => t.type === 'page');
      if (page) return page.webSocketDebuggerUrl;
    } catch {
      // Chrome is still coming up.
    }
    await sleep(200);
  }
  throw new Error('Chrome did not expose a debugging target.');
}

const socket = new WebSocket(await target());
await new Promise((resolve, reject) => {
  socket.addEventListener('open', resolve, { once: true });
  socket.addEventListener('error', reject, { once: true });
});

let nextId = 0;
const pending = new Map();
const events = [];
socket.addEventListener('message', (event) => {
  const msg = JSON.parse(event.data);
  if (msg.id !== undefined) {
    const entry = pending.get(msg.id);
    pending.delete(msg.id);
    if (msg.error) entry.reject(new Error(JSON.stringify(msg.error)));
    else entry.resolve(msg.result);
  } else {
    events.push(msg);
  }
});

const send = (method, params = {}) =>
  new Promise((resolve, reject) => {
    const id = (nextId += 1);
    pending.set(id, { resolve, reject });
    socket.send(JSON.stringify({ id, method, params }));
  });

async function shot(path) {
  const metrics = await send('Page.getLayoutMetrics');
  const size = metrics.cssContentSize;
  await send('Emulation.setDeviceMetricsOverride', {
    width,
    height: Math.min(Math.ceil(size.height), 16000),
    deviceScaleFactor: 1,
    mobile: false,
  });
  await sleep(300);
  const { data } = await send('Page.captureScreenshot', {
    format: 'png',
    captureBeyondViewport: true,
  });
  await writeFile(path, Buffer.from(data, 'base64'));
  await send('Emulation.clearDeviceMetricsOverride');
  console.log(`shot ${path}`);
}

await send('Page.enable');
await send('Runtime.enable');
await send('Log.enable');

// Before the first navigation, so the very first request carries them.
if (cookies.length > 0) {
  await send('Network.enable');
  for (const pair of cookies) {
    const separator = pair.indexOf('=');
    await send('Network.setCookie', {
      name: pair.slice(0, separator),
      value: pair.slice(separator + 1),
      url,
      path: '/',
      httpOnly: true,
    });
  }
}

await send('Page.navigate', { url });

// Wait for the load event rather than a fixed delay.
for (let attempt = 0; attempt < 150; attempt += 1) {
  if (events.some((e) => e.method === 'Page.loadEventFired')) break;
  await sleep(100);
}
await sleep(900);

for (const step of steps) {
  if (step.wait) await sleep(step.wait);
  else if (step.shot) await shot(step.shot);
  else if (step.eval) {
    const result = await send('Runtime.evaluate', {
      expression: step.eval,
      awaitPromise: true,
      returnByValue: true,
    });
    if (result.exceptionDetails) {
      console.error('eval failed:', JSON.stringify(result.exceptionDetails.exception?.description));
    } else if (result.result?.value !== undefined) {
      console.log('eval →', JSON.stringify(result.result.value));
    }
  }
}

await shot(out);

// Console errors are part of the definition of done ("no console errors").
const problems = events
  .filter((e) => e.method === 'Log.entryAdded' && e.params.entry.level === 'error')
  .map((e) => e.params.entry.text);
if (problems.length > 0) console.log('CONSOLE ERRORS:\n' + problems.join('\n'));
else console.log('CONSOLE ERRORS: none');

socket.close();
chrome.kill();
