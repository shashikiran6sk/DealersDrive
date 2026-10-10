import { chromium } from '/Applications/ChatGPT.app/Contents/Resources/cua_node/lib/node_modules/playwright/index.mjs';
import { writeFileSync } from 'node:fs';
const browser = await chromium.connectOverCDP('http://127.0.0.1:9223');
const results = [];
function assert(value, message) {
  if (!value) throw new Error(message);
}
async function noOverflow(page, label) {
  const size = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    width: innerWidth,
  }));
  assert(size.scroll <= size.width, `${label}: horizontal overflow`);
  results.push({ check: label, pass: true, ...size });
}
async function screen(page, name) {
  const email = page.getByText('<redacted-email>', { exact: true });
  const masks = [
    page.locator('input[type=tel]'),
    page.locator('input[autocomplete=one-time-code]'),
    page.locator('input[aria-label^="Digit"]'),
    email,
    page.getByText(/No SMS is sent in this environment/),
    page.getByText(/We sent a 6-digit code to/),
  ].filter(Boolean);
  await page.screenshot({
    path: `/tmp/dd-pr06-screenshots/${name}.png`,
    fullPage: true,
    mask: masks,
  });
}
async function otp(page, phone, label) {
  await page.locator('input[type=tel]:visible').fill(phone);
  await page.getByRole('button', { name: 'Send OTP', exact: true }).click();
  const digits = page.getByLabel(/^Digit /);
  await digits.first().waitFor();
  const widget = await (
    await page.request.get('http://127.0.0.1:4001/v1/auth/admin/phone/widget')
  ).json();
  for (let i = 0; i < widget.devCode.length; i++) await digits.nth(i).fill(widget.devCode[i]);
  await page.getByRole('button', { name: label, exact: true }).click();
}
for (const width of [320, 390, 768, 1280]) {
  const context = await browser.newContext({ viewport: { width, height: 900 } });
  const page = await context.newPage();
  await page.goto('http://127.0.0.1:3001/admin/login', { waitUntil: 'networkidle' });
  assert(
    (await page.getByRole('link', { name: 'Continue with Google', exact: true }).count()) === 1,
    'Google option missing',
  );
  await page.getByText('Continue with Mobile OTP', { exact: true }).click();
  await page.getByLabel(/Mobile number/).waitFor();
  await noOverflow(page, `admin login ${width}px`);
  await screen(page, `after-admin-login-${width}`);
  await context.close();
}
const context = await browser.newContext({ viewport: { width: 390, height: 900 } });
const page = await context.newPage();
await context.route('https://accounts.google.com/**', async (route) => {
  const url = new URL(route.request().url());
  const state = url.searchParams.get('state');
  assert(state, 'OAuth state absent');
  await route.fulfill({
    status: 302,
    headers: {
      Location: `http://127.0.0.1:4001/v1/auth/google/callback?state=${encodeURIComponent(state)}&code=controlled-browser-google-code`,
    },
    body: '',
  });
});
await page.goto('http://127.0.0.1:3001/admin/login');
await page.getByRole('link', { name: 'Continue with Google', exact: true }).click();
await page.waitForURL('http://127.0.0.1:3001/admin');
let cookies = await context.cookies();
assert(
  cookies.some((c) => c.name === 'dd_admin_session' && c.httpOnly && c.sameSite === 'Lax'),
  'admin cookie attributes invalid',
);
assert(!cookies.some((c) => c.name === 'dd_session'), 'Google admin contaminated person cookie');
results.push({ check: 'controlled Google real cookie login', pass: true });
await page.goto('http://127.0.0.1:3001/admin/profile/security');
await page.getByRole('heading', { name: 'Link Mobile Number', exact: true }).waitFor();
await screen(page, 'admin-security-link-390');
await otp(page, '<redacted-phone>', 'Verify and link mobile');
await page.getByText('+91 ••••••6060', { exact: true }).waitFor();
await noOverflow(page, 'linked security 390px');
await screen(page, 'admin-security-linked-390');
results.push({ check: 'recent Google enrollment through UI', pass: true });
await page.goto('http://127.0.0.1:3001/login');
await otp(page, '<redacted-phone>', 'Verify and sign in');
await page.waitForURL((url) => url.pathname !== '/login');
cookies = await context.cookies();
const person = cookies.find((c) => c.name === 'dd_session');
assert(person && person.httpOnly, 'customer cookie missing');
assert(
  cookies.some((c) => c.name === 'dd_admin_session'),
  'customer login lost admin cookie',
);
results.push({ check: 'same-number customer/admin identities remain isolated', pass: true });
await page.goto('http://127.0.0.1:3001/admin/profile/security');
const oldAdmin = (await context.cookies()).find((c) => c.name === 'dd_admin_session');
await page.getByRole('button', { name: 'Sign out', exact: true }).click();
await page.waitForURL('http://127.0.0.1:3001/admin/login');
cookies = await context.cookies();
assert(
  cookies.some((c) => c.name === 'dd_session' && c.value === person.value),
  'admin logout removed person session',
);
assert(!cookies.some((c) => c.name === 'dd_admin_session'), 'admin logout left cookie');
const old = await page.request.get('http://127.0.0.1:4001/v1/admin/profile/security', {
  headers: { Cookie: `dd_admin_session=${oldAdmin.value}` },
});
assert(old.status() === 401, 'revoked admin session replay succeeded');
results.push({ check: 'admin logout revocation/replay and person preservation', pass: true });
console.log('Waiting for the real 60-second challenge cooldown before mobile login');
await page.waitForTimeout(60_000);
await page.getByText('Continue with Mobile OTP', { exact: true }).click();
await otp(page, '<redacted-phone>', 'Verify and sign in');
await page.waitForURL('http://127.0.0.1:3001/admin');
assert(
  (await context.cookies()).some((c) => c.name === 'dd_session' && c.value === person.value),
  'OTP login changed person cookie',
);
results.push({ check: 'mobile OTP actual server-action login', pass: true });
const tab = await context.newPage();
await tab.goto('http://127.0.0.1:3001/admin/profile/security');
await tab.getByText(/Continue with Google again to link or revoke/).waitFor();
await tab.reload();
await tab.getByRole('heading', { name: 'Profile · Security', exact: true }).waitFor();
await screen(tab, 'admin-security-google-stepup-390');
results.push({ check: 'refresh, second tab and OTP enrollment/revocation step-up', pass: true });
await tab.getByRole('link', { name: 'Reauthenticate with Google', exact: true }).click();
await tab.waitForURL('http://127.0.0.1:3001/admin/profile/security');
await tab.getByLabel(/I understand this revokes mobile access/).check();
await tab.getByRole('button', { name: 'Revoke mobile access', exact: true }).click();
await tab.waitForURL(
  (url) => url.pathname === '/admin/login' && url.searchParams.get('error') === 'mobile_revoked',
);
assert(
  (await context.cookies()).some((c) => c.name === 'dd_session' && c.value === person.value),
  'recovery revocation removed person session',
);
results.push({ check: 'Google step-up and credential/global admin revocation UI', pass: true });
await tab.getByRole('link', { name: 'Continue with Google', exact: true }).click();
await tab.waitForURL('http://127.0.0.1:3001/admin');
await tab.goto('http://127.0.0.1:3001/admin/profile/security');
await otp(tab, '<redacted-phone>', 'Verify and link mobile');
await tab.getByText('+91 ••••••7070', { exact: true }).waitFor();
results.push({ check: 'controlled lost-phone recovery and new-number verification', pass: true });
for (const width of [320, 390, 768, 1280]) {
  await tab.setViewportSize({ width, height: 900 });
  await tab.reload();
  await tab.getByRole('heading', { name: 'Profile · Security', exact: true }).waitFor();
  await noOverflow(tab, `security ${width}px`);
  await screen(tab, `admin-security-${width}`);
}
await context.close();
await browser.close();
writeFileSync(
  '/tmp/dd-pr06-browser-results.json',
  JSON.stringify({ provider: 'controlled local Google/OTP; no live delivery', results }, null, 2),
);
console.log(
  `Browser campaign passed ${results.length} explicit checks; screenshots mask contact and OTP fields.`,
);
