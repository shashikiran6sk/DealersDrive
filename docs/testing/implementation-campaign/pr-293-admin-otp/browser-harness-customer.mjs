import { chromium } from 'playwright-core';
const [out, phone] = process.argv.slice(2);
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 390, height: 900 } });
const p = await ctx.newPage();
await p.goto('http://localhost:3000/login', { waitUntil: 'networkidle' });
await p.getByLabel('Mobile number').first().fill(phone);
await p.getByRole('button', { name: 'Send OTP' }).first().click();
const box = p.locator('input[autocomplete="one-time-code"]').first();
await box.waitFor();
await box.click();
await p.keyboard.type('123456');
const v = p.getByRole('button', { name: 'Verify and sign in' }).first();
if (await v.isEnabled().catch(() => false)) await v.click().catch(() => {});
await p.getByLabel('Name').fill('Regression Customer');
await p.getByRole('button', { name: 'Create account' }).click();
await p.waitForTimeout(4000);
const names = (await ctx.cookies()).map((c) => c.name);
const res = {
  url: new URL(p.url()).pathname,
  customerCookie: names.includes('dd_session'),
  adminCookie: names.includes('dd_admin_session'),
};
const admin = await ctx.newPage();
await admin.goto('http://localhost:3000/admin', { waitUntil: 'networkidle' });
res.customerOpeningAdmin = new URL(admin.url()).pathname;
await p.screenshot({ path: `${out}/6-customer-signed-in-390.png` });
console.log(JSON.stringify(res));
await b.close();
