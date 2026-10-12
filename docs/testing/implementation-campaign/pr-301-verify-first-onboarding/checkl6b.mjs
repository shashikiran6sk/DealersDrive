import { chromium } from 'playwright-core';
import { readFileSync } from 'node:fs';
const [out, S, dealerId] = process.argv.slice(2);
const B = 'http://localhost:3000';
const email = `l6.legacy.${Date.now().toString(36)}@example.test`;
const res = {};
function codeFor(address) {
  for (const line of readFileSync(`${S}/api.log`, 'utf8').split('\n').reverse()) {
    if (!line.includes(`"to":"${address}"`)) continue;
    const m = /\b(\d{6})\b/.exec(JSON.parse(line).msg ?? '');
    if (m) return m[1];
  }
  throw new Error('no code');
}
const b = await chromium.launch();
for (const width of [390, 1280]) {
  const c = await b.newContext({ viewport: { width, height: 900 } });
  await c.addCookies([{ name: 'dd_admin_session', value: readFileSync(`${S}/tok-l6-sales`, 'utf8').trim(), domain: 'localhost', path: '/' }]);
  const p = await c.newPage();
  await p.goto(`${B}/sales/dealers/${dealerId}`, { waitUntil: 'networkidle' });
  await p.screenshot({ path: `${out}/l6-verify-now-before-${width}.png`, fullPage: true });
  res[`overflow${width}`] = await p.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
  if (width === 1280) {
    await p.getByRole('checkbox').first().check();
    await p.getByRole('button', { name: 'Send OTP' }).first().click();
    const box = p.locator('input[autocomplete="one-time-code"]').first();
    await box.waitFor(); await box.click(); await p.keyboard.type('123456');
    const vb = p.getByRole('button', { name: /^Verify/ }).first();
    if (await vb.isEnabled().catch(() => false)) await vb.click().catch(() => {});
    await p.getByText('mobile verified', { exact: false }).first().waitFor({ timeout: 15000 });
    await p.getByLabel('Dealer’s email').fill(email);
    await p.getByRole('button', { name: 'Send code' }).click();
    const cb = p.locator('input[autocomplete="one-time-code"]').last();
    await cb.waitFor(); await p.waitForTimeout(500); await cb.click(); await p.keyboard.type(codeFor(email));
    const eb = p.getByRole('button', { name: 'Verify email' });
    if (await eb.isEnabled().catch(() => false)) await eb.click().catch(() => {});
    await p.getByText('Dealer’s email verified').waitFor({ timeout: 15000 });
    await p.getByRole('button', { name: 'Verify and link the owner' }).click();
    await p.waitForTimeout(3000);
    await p.reload({ waitUntil: 'networkidle' });
    await p.screenshot({ path: `${out}/l6-verify-now-after-${width}.png`, fullPage: true });
    const text = await p.locator('main').innerText();
    res.after = { ownerLinked: text.includes('Owner account linked'), verifyNowGone: !text.includes('Verify and link the owner'), email: text.includes(email) };
  }
  await c.close();
}
console.log(JSON.stringify(res, null, 1));
await b.close();
