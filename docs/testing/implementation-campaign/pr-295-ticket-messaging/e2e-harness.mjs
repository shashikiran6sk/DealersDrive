import { chromium } from 'playwright-core';
import { readFileSync } from 'node:fs';
const [out, S] = process.argv.slice(2);
const tok = (n) => readFileSync(`${S}/tok-${n}`, 'utf8').trim();
const API = 'http://localhost:4000';
const WEB = 'http://localhost:3000';
const res = {};
const call = async (cookie, method, path, body) => {
  const r = await fetch(API + path, {
    method,
    headers: { cookie, 'content-type': 'application/json', origin: WEB },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  return { status: r.status, body: await r.json().catch(() => null) };
};
const C = `dd_session=${tok('customer')}`,
  A = `dd_admin_session=${tok('super-admin')}`;
const created = await call(C, 'POST', '/v1/support/tickets', {
  category: 'GENERAL_QUESTION',
  subject: `E2E reopen ${Date.now()}`,
  description: 'Checking the resolved and closed lifecycle end to end.',
});
const id = created.body.id;
res.created = created.status;
for (let i = 1; i <= 5; i++)
  res[`msg${i}`] = (
    await call(C, 'POST', `/v1/support/tickets/${id}/messages`, { message: `Message ${i}` })
  ).status;
res.sixth = (
  await call(C, 'POST', `/v1/support/tickets/${id}/messages`, { message: 'Message 6' })
).body?.code;
res.resolve = (
  await call(A, 'PATCH', `/v1/admin/support/tickets/${id}`, { status: 'RESOLVED' })
).status;
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 390, height: 900 } });
await ctx.addCookies([
  { name: 'dd_session', value: tok('customer'), domain: 'localhost', path: '/' },
]);
const p = await ctx.newPage();
await p.goto(`${WEB}/support-requests/${id}`, { waitUntil: 'networkidle' });
res.resolvedView = {
  panel: await p.getByText('This request is resolved').count(),
  composer: await p.getByLabel('Reply to Dealers-Drive support').count(),
  reopenButton: await p.getByRole('button', { name: 'Reopen request' }).count(),
  overflow: await p.evaluate(() => document.documentElement.scrollWidth > innerWidth),
};
await p.screenshot({ path: `${out}/1-resolved-390.png`, fullPage: true });
res.forgedMessageWhileResolved = (
  await call(C, 'POST', `/v1/support/tickets/${id}/messages`, { message: 'forged' })
).body?.code;
await p.getByRole('button', { name: 'Reopen request' }).click();
await p.waitForTimeout(2500);
const after = await call(C, 'GET', `/v1/support/tickets/${id}`);
res.afterReopen = {
  status: after.body.status,
  remaining: after.body.remainingMessages,
  canReply: after.body.canReply,
  messages: after.body.messages.length,
  limitShown: await p.getByText("You've sent five messages").count(),
};
await p.screenshot({ path: `${out}/2-reopened-at-limit-390.png`, fullPage: true });
res.supportReply = (
  await call(A, 'POST', `/v1/admin/support/tickets/${id}/messages`, {
    message: 'Support here — looking now.',
  })
).status;
await p.reload({ waitUntil: 'networkidle' });
res.afterSupportReply = {
  composer: await p.getByLabel('Reply to Dealers-Drive support').count(),
  remaining: (await call(C, 'GET', `/v1/support/tickets/${id}`)).body.remainingMessages,
};
res.close = (
  await call(A, 'PATCH', `/v1/admin/support/tickets/${id}`, { status: 'CLOSED' })
).status;
await p.reload({ waitUntil: 'networkidle' });
res.closedView = {
  closedTitle: await p.getByText('This request is closed').count(),
  newRequest: await p.getByRole('link', { name: 'Create a new request' }).count(),
  composer: await p.getByLabel('Reply to Dealers-Drive support').count(),
  reopenButton: await p.getByRole('button', { name: 'Reopen request' }).count(),
};
res.reopenClosed = (await call(C, 'POST', `/v1/support/tickets/${id}/reopen`)).body?.code;
res.messageClosed = (
  await call(C, 'POST', `/v1/support/tickets/${id}/messages`, { message: 'after close' })
).body?.code;
await p.screenshot({ path: `${out}/3-closed-390.png`, fullPage: true });
console.log(JSON.stringify(res, null, 1));
await b.close();
