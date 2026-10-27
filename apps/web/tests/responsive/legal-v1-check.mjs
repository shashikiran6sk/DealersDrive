import { URL } from 'node:url';
import { Buffer } from 'node:buffer';
import console from 'node:console';
import fs from 'node:fs/promises';
import process from 'node:process';
import { setTimeout } from 'node:timers/promises';

const { fetch, WebSocket } = globalThis;
const base = process.env.LEGAL_BROWSER_WEB ?? 'http://localhost:3101';
const api = 'http://127.0.0.1:4191';
const debug = process.env.CHROME_DEBUG_URL ?? 'http://127.0.0.1:9231';
if (new URL(base).hostname !== 'localhost' || new URL(debug).hostname !== '127.0.0.1')
  throw Error('Only isolated local browsers are supported.');
const fixtures = JSON.parse(await fs.readFile('/tmp/dealers-drive-legal-browser.json', 'utf8'));
const output = process.env.LEGAL_BROWSER_OUTPUT ?? '../../docs/testing/legal-v1';
await fs.mkdir(output, { recursive: true });
const tab = await (await fetch(`${debug}/json/new`, { method: 'PUT' })).json();
const ws = new WebSocket(tab.webSocketDebuggerUrl);
await new Promise((resolve) => ws.addEventListener('open', resolve, { once: true }));
let sequence = 0;
let loads = 0;
const pending = new Map();
ws.addEventListener('message', (event) => {
  const value = JSON.parse(event.data);
  if (value.method === 'Page.loadEventFired') loads += 1;
  if (value.id) {
    const call = pending.get(value.id);
    pending.delete(value.id);
    if (value.error) call.reject(Error(JSON.stringify(value.error)));
    else call.resolve(value.result);
  }
});
const send = (method, params = {}) =>
  new Promise((resolve, reject) => {
    const id = ++sequence;
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params }));
  });
async function evaluate(expression) {
  const result = await send('Runtime.evaluate', {
    expression,
    returnByValue: true,
    awaitPromise: true,
  });
  if (result.exceptionDetails) throw Error(JSON.stringify(result.exceptionDetails));
  return result.result.value;
}
async function until(expression) {
  for (let attempt = 0; attempt < 200; attempt++) {
    if (await evaluate(expression)) return;
    await setTimeout(200);
  }
  throw Error(
    `Browser condition failed: ${expression}; ${await evaluate('document.body?.innerText.slice(0,1000)')}`,
  );
}
const results = [];
const assert = (condition, name) => {
  if (!condition) throw Error(name);
  results.push({ check: name, passed: true });
};
const navigate = async (path) => {
  const before = loads;
  await send('Page.navigate', { url: `${base}${path}` });
  for (let attempt = 0; attempt < 200 && loads <= before; attempt++) await setTimeout(200);
  await setTimeout(250);
};
const resize = (width) =>
  send('Emulation.setDeviceMetricsOverride', {
    width,
    height: 900,
    deviceScaleFactor: 1,
    mobile: width < 600,
  });
const cookie = async (token) => {
  await send('Network.clearBrowserCookies');
  if (token)
    await send('Network.setCookie', {
      name: 'dd_session',
      value: token,
      url: base,
      httpOnly: true,
      sameSite: 'Lax',
    });
};
const screenshot = async (name) => {
  const result = await send('Page.captureScreenshot', {
    format: 'png',
    captureBeyondViewport: true,
  });
  await fs.writeFile(`${output}/${name}.png`, Buffer.from(result.data, 'base64'));
};
async function request(token, path) {
  const result = await fetch(`${api}${path}`, { headers: { Cookie: `dd_session=${token}` } });
  return { status: result.status, body: await result.json() };
}
await send('Page.enable');
await send('Network.enable');
await send('Network.setBlockedURLs', { urls: ['https://*'] });
await cookie(null);
for (const [path, title, version] of [
  ['/terms', 'Terms & Conditions', 'terms-v1.0'],
  ['/privacy', 'Privacy Policy', 'privacy-v1.0'],
]) {
  assert((await fetch(`${base}${path}`)).status === 200, `${path} anonymous HTTP 200`);
  for (const width of [375, 768, 1024, 1280]) {
    await resize(width);
    await navigate(path);
    await until(`document.querySelector('article h1')?.textContent === ${JSON.stringify(title)}`);
    const state = await evaluate(
      `({overflow:document.documentElement.scrollWidth>innerWidth,text:document.querySelector('article').innerText,canonical:document.querySelector('link[rel=canonical]')?.href,description:document.querySelector('meta[name=description]')?.content,footer:Array.from(document.querySelectorAll('footer a[href="/terms"],footer a[href="/privacy"]')).map(a=>a.getAttribute('href'))})`,
    );
    assert(
      !state.overflow &&
        state.text.includes(version) &&
        state.text.includes('2026-10-24') &&
        state.canonical.endsWith(path) &&
        Boolean(state.description) &&
        state.footer.length === 2,
      `${path} metadata, version, date, footer and layout at ${width}px: ${JSON.stringify({ overflow: state.overflow, canonical: state.canonical, date: state.text.includes('2026-10-24'), footer: state.footer })}`,
    );
    if (width === 375 || width === 1280) await screenshot(`${path.slice(1)}-${width}`);
    await evaluate(
      `document.querySelector('footer a[href="${path === '/terms' ? '/privacy' : '/terms'}"]').click()`,
    );
    await until(`location.pathname === '${path === '/terms' ? '/privacy' : '/terms'}'`);
    assert(true, `footer navigation from ${path} at ${width}px`);
  }
}
assert(
  (await request(fixtures.customer, '/v1/saved-vehicles')).status === 403,
  'customer direct API denied before agreement',
);
await cookie(fixtures.customer);
for (const width of [375, 768, 1024, 1280]) {
  await resize(width);
  await navigate('/login?returnTo=%2Fsaved');
  await until("Boolean(document.querySelector('input[name=accepted]'))");
  const state = await evaluate(
    "(()=>{const c=document.querySelector('input[name=accepted]');return {checked:c.checked,required:c.required,valid:c.form.checkValidity(),overflow:document.documentElement.scrollWidth>innerWidth}})()",
  );
  assert(
    !state.checked && state.required && !state.valid && !state.overflow,
    `customer affirmative checkbox at ${width}px`,
  );
  if (width === 375 || width === 1280) await screenshot(`customer-checkbox-${width}`);
}
await evaluate("document.querySelector('input[name=accepted]').form.requestSubmit()");
assert(
  !(await request(fixtures.customer, '/v1/legal/status?scope=CUSTOMER')).body.accepted,
  'unchecked browser submission records no agreement',
);
await evaluate(
  "document.querySelector('input[name=accepted]').click(); document.querySelector('input[name=accepted]').form.requestSubmit()",
);
await until("location.pathname === '/saved' && !document.querySelector('input[name=accepted]')");
assert(
  (await request(fixtures.customer, '/v1/saved-vehicles')).status === 200,
  'customer server action accepts and unlocks saved cars',
);
await navigate('/login?returnTo=%2Fsaved');
await until("location.pathname === '/saved'");
assert(true, 'accepted customer skips gate on later authenticated entry');
await cookie(fixtures.draft);
assert(
  !(await request(fixtures.draft, '/v1/legal/status?scope=DEALER')).body.accepted,
  'dealer starts without fabricated agreement',
);
for (const width of [375, 768, 1024, 1280]) {
  await resize(width);
  await navigate('/dealer/onboarding?step=3');
  await until("Boolean(document.querySelector('input[name=accepted]'))");
  assert(
    await evaluate(
      "!document.querySelector('input[name=accepted]').checked && !document.querySelector('input[name=accepted]').form.checkValidity() && document.documentElement.scrollWidth <= innerWidth",
    ),
    `dealer review checkbox and preserved layout at ${width}px`,
  );
  if (width === 375 || width === 1280) await screenshot(`dealer-checkbox-${width}`);
}
await evaluate(
  "document.querySelector('input[name=accepted]').click(); document.querySelector('input[name=accepted]').form.requestSubmit()",
);
await until(
  "Boolean(Array.from(document.querySelectorAll('button')).find(button => button.textContent === 'Submit for verification'))",
);
assert(
  (await request(fixtures.draft, '/v1/legal/status?scope=DEALER')).body.accepted,
  'dealer owner agreement recorded independently of document submission',
);
await until(
  "Boolean(Array.from(document.querySelectorAll('button')).find(button => button.textContent === 'Submit for verification'))",
);
await evaluate(
  "Array.from(document.querySelectorAll('button')).find(button => button.textContent === 'Submit for verification').click()",
);
await until("document.body?.innerText?.includes('Under review')");
assert(
  (await request(fixtures.draft, '/v1/dealer')).body.status === 'PENDING_APPROVAL',
  'dealer onboarding state transitioned without repeating onboarding',
);
await navigate('/dealer/onboarding?step=3');
await until(
  "!document.querySelector('input[name=accepted]') && document.body?.innerText?.includes('review')",
);
assert(true, 'submitted dealer skips repeated agreement after refresh');
await cookie(fixtures.approved);
await navigate('/dealer');
await until("Boolean(document.querySelector('input[name=accepted]'))");
assert(
  (await request(fixtures.approved, '/v1/dealer')).status === 403,
  'approved dealer direct API cannot bypass one-time gate',
);
await evaluate(
  "document.querySelector('input[name=accepted]').click(); document.querySelector('input[name=accepted]').form.requestSubmit()",
);
await until(
  "!document.querySelector('input[name=accepted]') && document.body?.innerText?.includes('Dealer console')",
);
assert(
  (await request(fixtures.approved, '/v1/dealer')).body.status === 'ACTIVE',
  'approved dealer continues with status and privileges preserved',
);
await navigate('/v1/does-not-exist');
await cookie(null);
await navigate('/terms');
await until("Boolean(document.querySelector('article h1'))");
assert(true, 'policies remain available after ending authenticated browsing');
await fs.writeFile(
  `${output}/browser-results.json`,
  JSON.stringify(
    {
      environment: 'local synthetic database; fake authentication; external HTTPS blocked',
      checks: results,
    },
    null,
    2,
  ),
);
console.log(JSON.stringify({ checks: results.length, passed: true, screenshots: 8 }));
await send('Page.close');
ws.close();
