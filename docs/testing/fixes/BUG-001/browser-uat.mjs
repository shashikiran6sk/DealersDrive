import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? 'playwright');
const require = createRequire(new URL('../../../../apps/api/package.json', import.meta.url));
const { Client } = require('pg');
const fixture = JSON.parse(await fs.readFile('/tmp/dd-bug001-browser-private.json', 'utf8'));
const base = process.env.WEB_BASE_URL ?? 'http://localhost:3004',
  api = 'http://localhost:' + fixture.apiPort;
const dir = fileURLToPath(new URL('.', import.meta.url));
const databaseUrl = process.env.DATABASE_URL;
assert.ok(databaseUrl);
const database = new URL(databaseUrl);
assert.ok(['localhost', '127.0.0.1'].includes(database.hostname));
assert.equal(database.pathname, '/dealersdrive_cert');
const db = new Client({ connectionString: databaseUrl });
await db.connect();
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_EXECUTABLE ?? '/usr/bin/chromium',
  args: ['--no-sandbox'],
});
const results = [];
const navigation = [];
async function context(token, width) {
  const c = await browser.newContext({ viewport: { width, height: 900 } });
  await c.addCookies([
    {
      name: 'dd_session',
      value: token,
      domain: 'localhost',
      path: '/',
      httpOnly: true,
      secure: false,
      sameSite: 'Lax',
    },
  ]);
  return c;
}
try {
  for (const f of fixture.cases) {
    const owner = await context(fixture.owner.token, f.width),
      customer = await context(f.token, f.width);
    const ownerPage = await owner.newPage(),
      customerPage = await customer.newPage();
    customerPage.on('requestfailed', (r) =>
      navigation.push({
        viewport: f.width,
        outcome: f.outcome,
        path: new URL(r.url()).pathname,
        reason: r.failure()?.errorText,
      }),
    );
    await ownerPage.goto(base + '/dealer/team', { waitUntil: 'domcontentloaded' });
    await ownerPage
      .getByRole('button', { name: new RegExp('Withdraw the invitation to.*' + f.phone.slice(-5)) })
      .waitFor();
    await customerPage.goto(base + '/invitations', { waitUntil: 'domcontentloaded' });
    await customerPage
      .getByRole('button', { name: 'Accept and open dealer dashboard', exact: true })
      .waitFor();
    await customerPage.screenshot({
      path: `${dir}/before-${f.outcome}-${f.width}.png`,
      fullPage: true,
    });
    if (f.outcome === 'withdrawal') {
      await ownerPage
        .getByRole('button', {
          name: new RegExp('Withdraw the invitation to.*' + f.phone.slice(-5)),
        })
        .click();
      await ownerPage
        .getByRole('button', {
          name: new RegExp('Withdraw the invitation to.*' + f.phone.slice(-5)),
        })
        .waitFor({ state: 'detached' });
      // The existing customer tab still shows its invitation, so exercise stale UI.
      await customerPage
        .getByRole('button', { name: 'Accept and open dealer dashboard', exact: true })
        .click();
      await customerPage
        .getByText('The dealership withdrew this invitation.', { exact: true })
        .waitFor();
      const protectedRequest = await customer.request.get(api + '/v1/dealer');
      assert.equal(protectedRequest.status(), 401);
      await customerPage.screenshot({
        path: `${dir}/after-withdrawal-stale-tab-${f.width}.png`,
        fullPage: true,
      });
      await customerPage.reload({ waitUntil: 'domcontentloaded' });
      await customerPage.getByText('No invitations waiting', { exact: true }).waitFor();
    } else {
      await customerPage
        .getByRole('button', { name: 'Accept and open dealer dashboard', exact: true })
        .click();
      await customerPage.waitForURL(base + '/dealer', {
        timeout: 15000,
        waitUntil: 'domcontentloaded',
      });
      const dashboard = await customer.request.get(api + '/v1/dealer/dashboard');
      assert.equal(dashboard.status(), 200);
      const payload = await dashboard.json();
      await customerPage.getByRole('heading', { name: payload.greeting, exact: true }).waitFor();
      const protectedRequest = await customer.request.get(api + '/v1/dealer');
      assert.equal(protectedRequest.status(), 200);
      const ownerResult = await owner.request.delete(
        api + '/v1/dealer/team/invitations/' + f.invitationId,
      );
      assert.equal(ownerResult.status(), 404);
      await customerPage.screenshot({
        path: `${dir}/after-acceptance-dashboard-${f.width}.png`,
        fullPage: true,
      });
      await ownerPage.reload({ waitUntil: 'domcontentloaded' });
      assert.equal(
        await ownerPage
          .getByRole('button', {
            name: new RegExp('Withdraw the invitation to.*' + f.phone.slice(-5)),
          })
          .count(),
        0,
      );
    }
    const personal = await customer.request.get(api + '/v1/auth/customer/me');
    assert.equal(personal.status(), 200);
    await customerPage.goto(base + '/invitations', { waitUntil: 'domcontentloaded' });
    await customerPage.getByRole('button', { name: /^Account menu for / }).click();
    await customerPage.getByRole('menuitem', { name: 'Logout', exact: true }).click();
    await customerPage.waitForURL(/\/login/);
    assert.equal((await customer.request.get(api + '/v1/auth/customer/me')).status(), 401);
    const relogin = await customer.request.post(api + '/v1/auth/sign-in/phone/customer', {
      data: {
        phone: f.phone,
        accessToken: `dev-otp:91${f.phone}:123456:bug001-relogin-${Date.now()}`,
      },
    });
    assert.equal(relogin.status(), 200);
    assert.equal((await customer.request.get(api + '/v1/auth/customer/me')).status(), 200);
    assert.equal(
      (await customer.request.get(api + '/v1/dealer')).status(),
      f.outcome === 'withdrawal' ? 401 : 200,
    );
    await customerPage.goto(base + '/invitations', { waitUntil: 'domcontentloaded' });
    await customerPage.getByText('No invitations waiting', { exact: true }).waitFor();

    const row = (
      await db.query(
        'SELECT "status", "respondedBy", "respondedAt", "revokedBy", "revokedAt" FROM "dealer_invitations" WHERE "id"=$1::uuid',
        [f.invitationId],
      )
    ).rows[0];
    const members = (
      await db.query(
        'SELECT "dealerId", "userId", "role", "status", "invitedBy" FROM "dealer_members" WHERE "dealerId"=$1::uuid AND "userId"=$2::uuid',
        [fixture.owner.dealerId, f.userId],
      )
    ).rows;
    const audit = (
      await db.query(
        'SELECT "action", "actorId" FROM "audit_logs" WHERE ("entityId"=$1 OR ("dealerId"=$2::uuid AND "actorId"=$3::uuid AND "action"=\'member.joined\'))',
        [f.invitationId, fixture.owner.dealerId, f.userId],
      )
    ).rows;
    if (f.outcome === 'withdrawal') {
      assert.equal(row.status, 'REVOKED');
      assert.equal(row.revokedBy, fixture.owner.userId);
      assert.ok(row.revokedAt);
      assert.equal(row.respondedAt, null);
      assert.equal(members.length, 0);
      assert.equal(audit.filter((a) => a.action === 'member.invitation_revoked').length, 1);
      assert.equal(audit.filter((a) => a.action === 'member.joined').length, 0);
    } else {
      assert.equal(row.status, 'ACCEPTED');
      assert.equal(row.respondedBy, f.userId);
      assert.ok(row.respondedAt);
      assert.equal(row.revokedAt, null);
      assert.equal(members.length, 1);
      assert.equal(members[0].status, 'ACTIVE');
      assert.equal(members[0].role, 'STAFF');
      assert.equal(members[0].invitedBy, fixture.owner.userId);
      assert.equal(audit.filter((a) => a.action === 'member.joined').length, 1);
    }
    const dimensions = await customerPage.evaluate(() => ({
      width: innerWidth,
      scrollWidth: document.documentElement.scrollWidth,
    }));
    assert.ok(dimensions.scrollWidth <= f.width);
    results.push({
      viewport: f.width,
      outcome: f.outcome,
      status: row.status,
      membershipCount: members.length,
      role: members[0]?.role ?? null,
      personalAccount: personal.status(),
      actorCorrect: true,
      timestampCorrect: true,
      auditCorrect: true,
      uiLogout: true,
      fakeOtpRelogin: true,
      postLoginAuthorizationCorrect: true,
      ...dimensions,
    });
    await owner.close();
    await customer.close();
  }
} finally {
  await browser.close();
  await db.end();
  await fs.writeFile(
    dir + '/browser.json',
    JSON.stringify(
      {
        environment:
          'Built production Next.js :3004; current source API using local cert DB and fake providers; Chromium 151; private cookies outside repository',
        results,
        navigation,
      },
      null,
      2,
    ) + '\n',
  );
}
