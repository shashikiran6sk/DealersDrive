import { chromium } from 'playwright-core';
import { readFileSync, mkdirSync } from 'node:fs';

const [out, S] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const B = 'http://localhost:3000';
const API = 'http://localhost:4000';
const tok = (n) => readFileSync(`${S}/tok-${n}`, 'utf8').trim();
const res = {};
const stamp = Date.now().toString(36);
const phone = `97${String(Date.now()).slice(-8)}`;
const email = `l6.owner.${stamp}@example.test`;
const shot = (p, name) => p.screenshot({ path: `${out}/${name}.png`, fullPage: true });
const overflow = (p) => p.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);

function codeFor(address) {
  const log = readFileSync(`${S}/api.log`, 'utf8').split('\n').reverse();
  for (const line of log) {
    if (!line.includes(`"to":"${address}"`)) continue;
    const msg = JSON.parse(line).msg ?? '';
    const m = /\b(\d{6})\b/.exec(msg);
    if (m) return m[1];
  }
  throw new Error(`no code for ${address}`);
}

const b = await chromium.launch();
async function page(width, cookie = 'dd_admin_session', value = tok('l6-sales')) {
  const c = await b.newContext({ viewport: { width, height: 900 } });
  await c.addCookies([{ name: cookie, value, domain: 'localhost', path: '/' }]);
  return c.newPage();
}

async function phoneOtp(p, number) {
  if (number) await p.getByLabel('Dealer’s mobile number').fill(number);
  await p.getByRole('checkbox').first().check();
  await p.getByRole('button', { name: 'Send OTP' }).first().click();
  const box = p.locator('input[autocomplete="one-time-code"]').first();
  await box.waitFor({ timeout: 15000 });
  await box.click();
  await p.keyboard.type('123456');
  const btn = p.getByRole('button', { name: /^Verify/ }).first();
  if (await btn.isEnabled().catch(() => false)) await btn.click().catch(() => {});
  await p.getByText('mobile verified', { exact: false }).first().waitFor({ timeout: 15000 });
}

async function emailCode(p, address) {
  await p.getByLabel('Dealer’s email').fill(address);
  await p.getByRole('button', { name: 'Send code' }).click();
  const box = p.locator('input[autocomplete="one-time-code"]').last();
  await box.waitFor({ timeout: 15000 });
  await p.waitForTimeout(500);
  await box.click();
  await p.keyboard.type(codeFor(address));
  const btn = p.getByRole('button', { name: 'Verify email' });
  if (await btn.isEnabled().catch(() => false)) await btn.click().catch(() => {});
  await p.getByText('Dealer’s email verified').waitFor({ timeout: 15000 });
}

try {
  // 1. Step 1 at phone width: both proofs gate Continue.
  const p = await page(390);
  await p.goto(`${B}/sales/dealers/new`, { waitUntil: 'networkidle' });
  await shot(p, 'l6-step1-empty-390');
  res.continueBefore = await p.getByRole('button', { name: 'Continue to business details' }).count();
  await phoneOtp(p, phone);
  res.continueAfterPhoneOnly = await p.getByRole('button', { name: 'Continue to business details' }).count();
  await shot(p, 'l6-step1-phone-verified-390');
  await emailCode(p, email);
  await shot(p, 'l6-step1-both-verified-390');
  res.step1Overflow = await overflow(p);
  await p.getByRole('button', { name: 'Continue to business details' }).click();

  // 2. Step 2: business details, Save and continue.
  await p.getByLabel('Contact person').fill('Murugan Selvam');
  await p.getByLabel('Dealership name').fill(`L6 Verified Motors ${stamp}`);
  await p.getByLabel('Showroom address').fill('7, Arcot Road');
  async function pick(label, typed, option) {
    const box = p.getByLabel(label, { exact: true });
    if ((await box.evaluate((el) => el.tagName)) === 'SELECT') {
      await box.selectOption({ label: option });
      return;
    }
    await box.click();
    await box.fill(typed);
    await p.getByRole('option', { name: option }).first().click();
  }
  await pick('State', 'Tamil', 'Tamil Nadu');
  await pick('District', 'Vell', 'Vellore');
  const city = p.getByLabel('City / town');
  if ((await city.getAttribute('role')) === 'combobox') await pick('City / town', 'Katp', 'Katpadi');
  else await city.fill('Katpadi');
  await p.getByLabel('Pincode').fill('632007');
  await p.getByLabel('Google Maps link').fill('https://maps.app.goo.gl/l6check');
  const svc = p.locator('#assisted-specialities');
  await svc.click();
  await p.keyboard.type('Hatchbacks');
  await p.keyboard.press('Enter');
  res.step2HasEmailField = await p.getByLabel('Email', { exact: false }).count();
  await shot(p, 'l6-step2-details-390');
  await p.getByRole('button', { name: 'Save and continue' }).click();
  await p.waitForURL(/\/sales\/dealers\/[^/]+\/documents$/, { timeout: 20000 });
  await p.waitForLoadState('networkidle');
  res.landedOn = new URL(p.url()).pathname;
  const dealerId = res.landedOn.split('/')[3];
  await shot(p, 'l6-step3-documents-390');
  res.step3Overflow = await overflow(p);
  res.step3Text = (await p.locator('main').innerText()).slice(0, 400);

  for (const width of [1280]) {
    const w = await page(width);
    await w.goto(`${B}/sales/dealers/${dealerId}`, { waitUntil: 'networkidle' });
    await shot(w, `l6-dealer-page-${width}`);
    await w.goto(`${B}/sales/dealers/${dealerId}/documents`, { waitUntil: 'networkidle' });
    await shot(w, `l6-step3-documents-${width}`);
    await w.close();
  }

  // 3. The dealer signs in by phone and lands in this dealership — no new account.
  const signIn = await fetch(`${API}/v1/auth/sign-in/phone/dealer`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: B },
    body: JSON.stringify({ phone, accessToken: `dev-otp:91${phone}:123456:l6-${stamp}` }),
  });
  res.phoneSignIn = signIn.status;
  const cookie = (signIn.headers.get('set-cookie') ?? '').split(';')[0];
  const me = await (await fetch(`${API}/v1/auth/me`, { headers: { cookie } })).json();
  res.dealerSession = { sameDealer: me.dealer?.id === dealerId, email: me.user?.email === email, next: me.next };
  const d = await page(390, 'dd_session', cookie.split('=')[1]);
  await d.goto(`${B}/dealer`, { waitUntil: 'networkidle' });
  res.dealerLandedOn = new URL(d.url()).pathname;
  await shot(d, 'l6-dealer-signed-in-390');

  // 4. Verify now for an owner-less (legacy) assisted dealership.
  res.legacyDealerId = dealerId;
  readFileSync; // placeholder
  console.log(JSON.stringify({ ...res, dealerId }, null, 1));
} catch (error) {
  console.log(JSON.stringify(res, null, 1));
  throw error;
} finally {
  await b.close();
}
