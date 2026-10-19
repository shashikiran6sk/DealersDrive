import {
  chromium,
  request,
} from '/Applications/ChatGPT.app/Contents/Resources/cua_node/lib/node_modules/playwright/index.mjs';
import { readFileSync, writeFileSync } from 'node:fs';
const b = await chromium.connectOverCDP('http://127.0.0.1:9223');
const context = await b.newContext({ viewport: { width: 390, height: 900 } });
const p = await context.newPage();
const api = await request.newContext();
const checks = [];
function assert(v, m) {
  if (!v) throw new Error(m);
}
async function otp(phone) {
  await p.locator('input[type=tel]:visible').fill(phone);
  await p.getByRole('button', { name: 'Send OTP', exact: true }).click();
  const digits = p.getByLabel(/^Digit /);
  await digits.first().waitFor();
  const widget = await (
    await p.request.get('http://127.0.0.1:4001/v1/auth/admin/phone/widget')
  ).json();
  for (let i = 0; i < widget.devCode.length; i++) await digits.nth(i).fill(widget.devCode[i]);
  await p.getByRole('button', { name: 'Verify and sign in', exact: true }).click();
}
await p.goto('http://127.0.0.1:3001/admin/login');
await p.getByRole('link', { name: 'Continue with Google', exact: true }).click();
await p.waitForURL('http://127.0.0.1:3001/admin');
const admin = (await context.cookies()).find((c) => c.name === 'dd_admin_session');
assert(admin, 'admin cookie absent');
await p.goto('http://127.0.0.1:3001/login');
await otp('<redacted-phone>');
await p.waitForURL((u) => u.pathname !== '/login');
const person = (await context.cookies()).find((c) => c.name === 'dd_session');
assert(person, 'customer cookie absent');
await api.post('http://127.0.0.1:4001/v1/auth/admin/logout', {
  headers: { Cookie: `dd_admin_session=${person.value}` },
});
assert(
  (
    await api.get('http://127.0.0.1:4001/v1/auth/customer/me', {
      headers: { Cookie: `dd_session=${person.value}` },
    })
  ).status() === 200,
  'forged admin logout revoked person',
);
checks.push({ check: 'wrong-scope admin logout cannot revoke customer session', pass: true });
await p.request.post('http://127.0.0.1:4001/v1/auth/customer/logout');
assert(
  (await p.request.get('http://127.0.0.1:4001/v1/admin/profile/security')).status() === 200,
  'customer logout revoked admin',
);
assert(!(await context.cookies()).some((c) => c.name === 'dd_session'), 'customer cookie remained');
checks.push({ check: 'customer logout preserves admin session', pass: true });
await p.goto('http://127.0.0.1:4001/v1/auth/google/start');
await p.waitForURL((u) => u.pathname === '/dealer/onboarding');
assert(
  (await p.request.get('http://127.0.0.1:4001/v1/auth/me')).status() === 200,
  'dealer Google session absent',
);
await api.post('http://127.0.0.1:4001/v1/auth/customer/logout', {
  headers: { Cookie: `dd_session=${admin.value}` },
});
assert(
  (
    await api.get('http://127.0.0.1:4001/v1/admin/profile/security', {
      headers: { Cookie: `dd_admin_session=${admin.value}` },
    })
  ).status() === 200,
  'wrong-scope customer logout revoked admin',
);
checks.push({ check: 'wrong-scope customer logout cannot revoke admin session', pass: true });
await p.request.post('http://127.0.0.1:4001/v1/auth/logout');
assert(
  (await p.request.get('http://127.0.0.1:4001/v1/admin/profile/security')).status() === 200,
  'dealer logout revoked admin',
);
checks.push({ check: 'dealer Google sign-in/logout preserves admin session', pass: true });
await p.goto('http://127.0.0.1:3001/admin/profile/security');
const masked = [
  p.getByText('<redacted-email>', { exact: true }),
  p.locator('input[type=tel]'),
  p.locator('input[aria-label^="Digit"]'),
];
for (const width of [320, 390, 768, 1280]) {
  await p.setViewportSize({ width, height: 900 });
  await p.reload();
  await p.getByRole('heading', { name: 'Profile · Security', exact: true }).waitFor();
  await p.screenshot({
    path: `/tmp/dd-pr06-screenshots/admin-security-${width}.png`,
    fullPage: true,
    mask: masked,
    maskColor: '#374151',
  });
}
const started = await api.post('http://127.0.0.1:4001/v1/auth/admin/phone/challenge', {
  headers: { Origin: 'http://127.0.0.1:3001' },
  data: { phone: '<redacted-phone>' },
});
assert(started.status() === 200, 'rotation challenge refused');
const c = await started.json();
const widget = await (await api.get('http://127.0.0.1:4001/v1/auth/admin/phone/widget')).json();
const verified = await api.post('http://127.0.0.1:4001/v1/auth/admin/phone/verify', {
  headers: { Origin: 'http://127.0.0.1:3001', Cookie: `dd_admin_session=${admin.value}` },
  data: {
    challengeId: c.challengeId,
    browserToken: c.browserToken,
    accessToken: `dev-otp:<redacted-phone>:${widget.devCode}:${Date.now()}`,
  },
});
assert(verified.status() === 200, 'session rotation refused');
assert(
  (await p.request.get('http://127.0.0.1:4001/v1/admin/profile/security')).status() === 401,
  'old admin token survived OTP rotation',
);
checks.push({ check: 'OTP rotation prevents old-session replay and fixation', pass: true });
await context.close();
await api.dispose();
for (const width of [320, 390, 768, 1280]) {
  const ctx = await b.newContext({ viewport: { width, height: 900 } });
  const page = await ctx.newPage();
  await page.goto('http://127.0.0.1:3001/admin/login');
  await page.getByText('Continue with Mobile OTP', { exact: true }).click();
  await page.screenshot({
    path: `/tmp/dd-pr06-screenshots/after-admin-login-${width}.png`,
    fullPage: true,
    mask: [page.locator('input[type=tel]')],
    maskColor: '#374151',
  });
  await ctx.close();
}
await b.close();
const result = JSON.parse(readFileSync('/tmp/dd-pr06-browser-results.json', 'utf8'));
result.results.push(...checks);
writeFileSync('/tmp/dd-pr06-browser-results.json', JSON.stringify(result, null, 2));
console.log(
  `Additional isolation and fixation checks passed: ${checks.length}. Total browser checks: ${result.results.length}. No tokens printed.`,
);
