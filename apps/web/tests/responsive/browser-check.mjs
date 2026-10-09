import { Buffer } from 'node:buffer';
import console from 'node:console';
import process from 'node:process';
import { clearTimeout, setTimeout } from 'node:timers';
const { fetch, WebSocket } = globalThis;
import fs from 'node:fs/promises';
const debugUrl = process.env.CHROME_DEBUG_URL ?? 'http://127.0.0.1:9222';
const tab = await (await fetch(`${debugUrl}/json/new`, { method: 'PUT' })).json();
const ws = new WebSocket(tab.webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener('open', r, { once: true }));
let id = 0;
const pending = new Map();
ws.addEventListener('message', (e) => {
  const m = JSON.parse(e.data);
  if (m.id) {
    const p = pending.get(m.id);
    pending.delete(m.id);
    if (m.error) p.reject(Error(JSON.stringify(m.error)));
    else p.resolve(m.result);
  }
});
const send = (method, params = {}) =>
  new Promise((resolve, reject) => {
    const n = ++id;
    const timeout = setTimeout(() => {
      pending.delete(n);
      reject(Error(`Browser command timed out: ${method}`));
    }, 30000);
    pending.set(n, {
      resolve: (result) => {
        clearTimeout(timeout);
        resolve(result);
      },
      reject: (error) => {
        clearTimeout(timeout);
        reject(error);
      },
    });
    ws.send(JSON.stringify({ id: n, method, params }));
  });
const evaluate = async (expression) => {
  const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw Error(JSON.stringify(r.exceptionDetails));
  return r.result.value;
};
const pause = (ms) => new Promise((r) => setTimeout(r, ms));
await send('Page.enable');

// Run against the local Storybook fixtures with an existing headless Chromium.
// CHROME_DEBUG_URL=http://127.0.0.1:9222 SANDBOX_URL=http://127.0.0.1:6006 node tests/responsive/browser-check.mjs
const sandbox = process.env.SANDBOX_URL ?? 'http://127.0.0.1:6006';
const output = process.env.RESPONSIVE_EVIDENCE_DIR ?? '/tmp/dealersdrive-responsive';
const widths = [320, 360, 375, 390, 430, 440, 768, 1024, 1280, 1440];
const availableStories = [
  'layout-customerheader--home',
  'layout-customerheader--signed-in-customer',
  'layout-customerfooter--default',
  'home-herobanner--no-photograph',
  'home-informationsections--mobile',
  'home-discoveryrow--four-cars',
  'forms-otpinput--empty',
  'forms-otpinput--eight-digits',
  'forms-otpinput--in-dialog',
  'forms-phoneverification--code-entry',
  'forms-phoneverification--refused',
  'forms-phonesignin--code-entry',
  'forms-onboardingwizard--business',
  'forms-onboardingwizard--documents',
  'forms-onboardingwizard--review',
  'dealer-dashboardpanels--long-names-at-phone-width',
  'dealer-listingstats--populated',
  'dealer-inventoryview--every-status',
  'dealer-inventoryview--empty',
  'dealer-enquiryinbox--new',
  'dealer-dealerprofileform--populated',
  'dealer-team--owner-with-team',
  'vehicle-vehiclegallery--twenty',
  'vehicle-vehiclegallery--portrait',
  'vehicle-vehiclegallery--one-photo',
  'vehicle-vehiclecard--long-title',
  'vehicle-vehiclecard--reserved',
  'vehicle-vehiclecard--sold',
  'dealers-dealerinventory--playground',
  'dealers-directoryfilters--many-cities',
  'admin-configrow--string-list',
  'admin-dealeradminactions--pending-and-ready-to-approve',
  'admin-documentreview--mixed-states',
  'admin-enquirydetail--mobile',
  'admin-enquiryoversight--list',
  'admin-listingreview--ready-to-approve',
  'admin-moderationqueue--waiting',
  'admin-supportqueue--queue',
  'admin-supportticketworkspace--working',
  'admin-adminmembers--mixed-team',
  'admin-notificationlog--mixed',
  'sales-assisteddealerform--create',
  'sales-assisteddealerstart--consent-and-otp',
  'sales-salesdealerlist--mixed',
  'sales-salesvehiclelist--approved',
  'primitives-dialog--wide',
  'search-mobilefiltersheet--with-filters-applied',
  'layout-mobilenav--dealer',
  'layout-mobilenav--admin',
  'layout-mobilenav--restricted-admin',
  'layout-mobilenav--sales',
];
const stories = process.env.RESPONSIVE_STORIES?.split(',') ?? availableStories;
const index = await (await fetch(`${sandbox}/index.json`)).json();
const results = [];
const failures = [];
await fs.mkdir(output, { recursive: true });
for (const story of stories) {
  if (!index.entries[story]) {
    failures.push({ story, reason: 'Missing story' });
    continue;
  }
  await send('Emulation.setDeviceMetricsOverride', {
    width: 390,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await send('Page.bringToFront');
  await send('Page.navigate', { url: `${sandbox}/iframe.html?id=${story}&viewMode=story` });
  await pause(200);
  let ready = false;
  for (let n = 0; n < 150; n++) {
    if (await evaluate("document.body?.innerText.includes('The component failed to render')"))
      break;
    if (await evaluate("document.querySelector('#storybook-root')?.children.length > 0")) {
      ready = true;
      break;
    }
    await pause(100);
  }
  await pause(250);
  if (
    !ready ||
    (await evaluate("document.body?.innerText.includes('The component failed to render')"))
  ) {
    failures.push({
      story,
      reason: 'Render failed',
      text: await evaluate('document.body?.innerText.slice(0,350)'),
    });
    continue;
  }
  const dialogStory =
    story.startsWith('vehicle-vehiclegallery') ||
    story.startsWith('layout-mobilenav') ||
    story.startsWith('primitives-dialog') ||
    story.startsWith('search-mobilefilter');
  if (dialogStory) await evaluate("document.querySelector('#storybook-root button')?.click()");
  await pause(220);
  for (const width of widths) {
    await send('Emulation.setDeviceMetricsOverride', {
      width,
      height: 900,
      deviceScaleFactor: 1,
      mobile: false,
    });
    await pause(100);
    if (
      story.startsWith('layout-mobilenav') &&
      width < 768 &&
      !(await evaluate("!!document.querySelector('[role=dialog]')"))
    ) {
      await evaluate("document.querySelector('#storybook-root button')?.click()");
      await pause(80);
    }
    const data = await evaluate(`(() => {
      const boxes = [...document.querySelectorAll('input[aria-label^="Digit "]')].map(e => {
        const r=e.getBoundingClientRect();return { x:r.x, y:r.y, width:r.width, right:r.right, keyboard:e.inputMode };
      });
      return { scroll:document.documentElement.scrollWidth, viewport:innerWidth,
        boxes, overflow:[...document.querySelectorAll('*')].filter(e => {
          const b=e.getBoundingClientRect(); return b.width && (b.right>innerWidth+1||b.left<-1)
            && !e.closest('[role="region"].overflow-x-auto,.overflow-x-auto,.dd-strip,.dd-rail,[role="group"].overflow-x-auto');
        }).slice(0,8).map(e => ({tag:e.tagName,classes:e.className,right:e.getBoundingClientRect().right})) };
    })()`);
    const errors = [];
    if (data.scroll > width + 1) errors.push('Document overflow');
    if (
      width < 768 &&
      data.boxes.length &&
      (new Set(data.boxes.map((b) => b.y)).size !== 1 ||
        data.boxes.some((b) => b.x < 0 || b.right > width + 1))
    )
      errors.push('OTP leaves one row or viewport');
    if (width < 768 && data.boxes.some((b) => b.width < 20)) errors.push('OTP fields collapse');
    if (
      data.boxes.length &&
      Math.max(...data.boxes.map((b) => b.width)) - Math.min(...data.boxes.map((b) => b.width)) > 1
    )
      errors.push('OTP widths differ');
    if (data.boxes.some((b) => b.keyboard !== 'numeric'))
      errors.push('OTP numeric keyboard missing');
    results.push({ story, width, ...data, errors });
    if (errors.length) failures.push({ story, width, errors, overflow: data.overflow });
    const shot = await send('Page.captureScreenshot', {
      format: 'png',
      captureBeyondViewport: false,
    });
    await fs.writeFile(`${output}/${story}-${width}.png`, Buffer.from(shot.data, 'base64'));
  }
  console.log(
    story,
    results.filter((r) => r.story === story && r.errors.length).map((r) => r.width),
  );
}
await fs.writeFile(`${output}/results.json`, JSON.stringify({ results, failures }, null, 2));
console.log(JSON.stringify({ viewports: results.length, failures }, null, 2));
ws.close();
if (failures.length) process.exitCode = 1;
