import { chromium } from 'playwright-core';
import { readFileSync } from 'node:fs';
const [out, S, adminPhone, customerPhone] = process.argv.slice(2);
const b = await chromium.launch();
const res = {};
async function otpFlow(p, phone, verifyLabel) {
  await p.getByLabel('Mobile number').first().fill(phone);
  await p.getByRole('button', { name: 'Send OTP' }).first().click();
  const box = p.locator('input[autocomplete="one-time-code"]').first();
  try {
    await box.waitFor({ timeout: 15000 });
  } catch (e) {
    throw new Error(
      'OTP boxes missing; page says: ' +
        (await p.evaluate(() => document.querySelector('main')?.innerText.slice(0, 600))),
    );
  }
  await box.click();
  await p.keyboard.type('123456');
  const btn = p.getByRole('button', { name: verifyLabel }).first();
  if (await btn.isEnabled().catch(() => false)) await btn.click().catch(() => {});
}
// 1. enrol from the security page (Google-authenticated admin session)
{
  const ctx = await b.newContext({ viewport: { width: 390, height: 900 } });
  await ctx.addCookies([
    {
      name: 'dd_admin_session',
      value: readFileSync(`${S}/tok-google-super`, 'utf8').trim(),
      domain: 'localhost',
      path: '/',
    },
  ]);
  const p = await ctx.newPage();
  await p.goto('http://localhost:3000/admin/profile/security', { waitUntil: 'networkidle' });
  await p.screenshot({ path: `${out}/1-security-before-390.png`, fullPage: true });
  await otpFlow(p, adminPhone, 'Verify and link mobile');
  await p.waitForTimeout(3000);
  const text = await p.evaluate(() => document.body.innerText);
  res.enroll = {
    linkedBanner: text.includes('Mobile number verified and linked'),
    failure: /did not match|could not be completed/.test(text),
    overflow: await p.evaluate(() => document.documentElement.scrollWidth > innerWidth),
  };
  await p.screenshot({ path: `${out}/2-security-after-enrol-390.png`, fullPage: true });
  await ctx.close();
}
// 2. fresh browser: admin login with the linked mobile (after the 60 s per-number resend window)
await new Promise((r) => setTimeout(r, 62_000));
{
  const ctx = await b.newContext({ viewport: { width: 390, height: 900 } });
  const p = await ctx.newPage();
  await p.goto('http://localhost:3000/admin/login', { waitUntil: 'networkidle' });
  await p.screenshot({ path: `${out}/3-admin-login-390.png`, fullPage: true });
  await p.getByText('Continue with Mobile OTP').click();
  await otpFlow(p, adminPhone, 'Verify and sign in');
  await p.waitForURL(/\/admin(\/|$)(?!login)/, { timeout: 15000 }).catch(() => {});
  const cookies = (await ctx.cookies()).map((c) => c.name);
  res.adminLogin = {
    url: new URL(p.url()).pathname,
    adminCookie: cookies.includes('dd_admin_session'),
    customerCookie: cookies.includes('dd_session'),
  };
  await p.screenshot({ path: `${out}/4-admin-after-mobile-login-390.png` });
  // same browser: customer area must not be signed in by the admin session
  await p.goto('http://localhost:3000/account', { waitUntil: 'networkidle' });
  res.adminLogin.customerAreaPath = new URL(p.url()).pathname;
  await ctx.close();
}
// 3. customer OTP regression
{
  const ctx = await b.newContext({ viewport: { width: 390, height: 900 } });
  const p = await ctx.newPage();
  await p.goto('http://localhost:3000/login', { waitUntil: 'networkidle' });
  await otpFlow(p, customerPhone, 'Verify and sign in');
  await p.waitForTimeout(4000);
  const cookies = (await ctx.cookies()).map((c) => c.name);
  res.customerLogin = {
    url: new URL(p.url()).pathname,
    customerCookie: cookies.includes('dd_session'),
    adminCookie: cookies.includes('dd_admin_session'),
  };
  await p.screenshot({ path: `${out}/5-customer-after-login-390.png` });
  await ctx.close();
}
console.log(JSON.stringify(res, null, 1));
await b.close();
