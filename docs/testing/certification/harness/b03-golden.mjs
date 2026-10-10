// Browser campaign 3: GOLDEN-001..010 end-to-end journeys.
// Browser (Chromium) drives every decision a person makes in the UI: search,
// sign-in (fake OTP through the real web form), enquiry, save, inbox actions,
// confirmations, team management, invitations, workspace switching and Admin
// moderation. Three setup steps run through the real API because their UI depends
// on providers this environment cannot reach, and each result says so:
//   - dealer onboarding (Google identity required → SIM-GOOGLE),
//   - vehicle draft details (the add-vehicle wizard depends on the RC lookup provider),
//   - Admin photography uploads (file chooser to the same presign → PUT → commit route).
import * as b from './bkit.mjs';
import * as h from './lib.mjs';
import * as w from './world.mjs';

const r = h.recorder('browser-golden');
const admin = await h.admin('cert-admin@example.test');
const HYBRID =
  'Hybrid journey: setup via API where noted (onboarding SIM-GOOGLE, vehicle details, photography); every human decision in the browser; outcomes verified in the DB.';

function vehicle(tag) {
  return { ...w.COMPLETE_VEHICLE, make: 'Tata', model: 'Nexon', variant: `XZ ${tag}` };
}
async function liveDealer(label) {
  const D = await w.onboard(label);
  const ap = await w.approveDealer(admin, D.dealerId);
  if (ap.status !== 200) throw new Error(`approve ${ap.status}`);
  return D;
}
async function dialogConfirm(page, confirmName, { reason } = {}) {
  const dlg = page.getByRole('dialog');
  await dlg.waitFor();
  const select = dlg.locator('select').first();
  if (await select.count()) {
    const values = await select.evaluate((s) => [...s.options].map((o) => o.value).filter(Boolean));
    if (values.length) await select.selectOption(values[0]);
  }
  const text = dlg.locator('textarea, input[type=text]').first();
  if (reason && (await text.count())) await text.fill(reason);
  await dlg.getByRole('button', { name: confirmName }).last().click();
  await dlg.waitFor({ state: 'detached', timeout: 15000 });
  await page.waitForLoadState('networkidle');
}
const enquiryOf = (id) => h.one(`SELECT id, status FROM enquiries WHERE id=$1`, [id]);
const listingOf = (id) => h.one(`SELECT status FROM listings WHERE id=$1`, [id]);
async function audits(entityId) {
  return (
    await h.q(`SELECT action, "actorId" FROM audit_logs WHERE "entityId"=$1 ORDER BY "createdAt"`, [
      entityId,
    ])
  ).map((x) => x.action);
}

await h.check(r, 'GOLDEN-001', async () => {
  const tag = `G1${h.nonce().slice(0, 6)}`;
  const D = await liveDealer('Golden1');
  const car = await w.published(D, admin, vehicle(tag));
  const staff = await w.addMember(D, 'STAFF', 'Golden1 Staff');
  const manager = await w.addMember(D, 'MANAGER', 'Golden1 Manager');
  // Visitor: search → car → login/OTP → enquiry
  const vctx = await b.context();
  const { page } = await b.open(vctx, '/');
  await page.getByLabel('Search cars by make, model or variant').fill(tag);
  await page.keyboard.press('Enter');
  await page.waitForURL((u) => u.pathname === '/cars');
  await page.locator(`a[href="/car/${car.slug}"]`).first().click();
  await page.waitForURL((u) => u.pathname === `/car/${car.slug}`);
  await page.getByRole('button', { name: 'Enquire now' }).click();
  await page.waitForURL((u) => u.pathname === '/login', { timeout: 15000 });
  const phone = b.freshPhone('91');
  await page.locator('input[name=phone]:visible').first().fill(phone.replace('+91', ''));
  await page.getByRole('button', { name: 'Send OTP' }).first().click();
  await page.getByLabel('Digit 1 of 6').click();
  await page.keyboard.type('123456');
  await page.getByRole('button', { name: 'Verify and sign in' }).click();
  await page.locator('input[name=fullName]').fill('Golden One Buyer');
  await page.getByRole('button', { name: 'Create account' }).click();
  await page.waitForURL((u) => u.pathname === `/car/${car.slug}`, { timeout: 15000 });
  await page
    .locator('textarea[name=message]')
    .fill('Golden journey: is a test drive possible on Saturday?');
  await page.getByRole('button', { name: 'Send enquiry' }).click();
  await page.waitForLoadState('networkidle');
  await b.sleep(800);
  await b.shot(page, 'GOLDEN-001-enquiry-sent');
  await vctx.close();
  const e = await h.one(
    `SELECT e.id, e.status FROM enquiries e JOIN listings l ON l.id=e."listingId" WHERE l.id=$1 ORDER BY e."createdAt" DESC LIMIT 1`,
    [car.listingId],
  );
  h.assert(e.status === 'NEW', `enquiry ${e.status}`);
  // STAFF contacts (dealer console)
  const sctx = await b.context({ cookie: staff.cookie });
  const s = await b.open(sctx, '/dealer/enquiries');
  h.assert(
    await s.page.getByText('Golden One Buyer').first().isVisible(),
    'dealer did not receive the enquiry',
  );
  const staffSeesClose = await s.page.getByRole('button', { name: 'Close' }).count();
  await s.page.getByRole('button', { name: 'Mark contacted' }).first().click();
  await s.page.waitForLoadState('networkidle');
  await b.sleep(800);
  await sctx.close();
  h.assert((await enquiryOf(e.id)).status === 'CONTACTED', 'staff contact');
  // MANAGER closes
  const mctx = await b.context({ cookie: manager.cookie });
  const m = await b.open(mctx, '/dealer/enquiries?status=CONTACTED');
  await m.page.getByRole('button', { name: 'Close' }).first().click();
  if (await m.page.getByRole('dialog').count()) await dialogConfirm(m.page, /close/i);
  await m.page.waitForLoadState('networkidle');
  await b.sleep(800);
  await mctx.close();
  h.assert((await enquiryOf(e.id)).status === 'CLOSED', 'manager close');
  // Admin sees history
  const actx = await b.context({ cookie: admin.cookie });
  const a = await b.open(actx, `/admin/enquiries/${e.id}`);
  const adminText = await a.page.evaluate(() => document.querySelector('main')?.innerText ?? '');
  await b.shot(a.page, 'GOLDEN-001-admin-history');
  await actx.close();
  const trail = await audits(e.id);
  r.ev({
    enquiry: e.id,
    staffSeesClose,
    trail,
    adminShowsClosed: /Closed/.test(adminText),
    adminShowsContacted: /Contacted/.test(adminText),
  });
  h.assert(/Closed/.test(adminText) && /Contacted/.test(adminText), 'admin history');
  return {
    layers: ['BROWSER', 'API', 'DATABASE'],
    auth: 'FAKE-OTP',
    note: `search "${tag}" → car → Enquire → OTP sign-up → enquiry NEW → STAFF "Mark contacted" (CONTACTED; STAFF sees ${staffSeesClose} Close buttons) → MANAGER "Close" (CLOSED) → Admin enquiry page shows Contacted and Closed; audit ${JSON.stringify(trail)}. ${HYBRID}`,
  };
});

await h.check(r, 'GOLDEN-002', async () => {
  const D = await liveDealer('Golden2');
  const car = await w.published(D, admin, vehicle(`G2${h.nonce().slice(0, 5)}`));
  const phone = b.freshPhone('92');
  const ctx = await b.context();
  const page = await ctx.newPage();
  await b.uiLogin(page, { phone, name: 'Golden Two', returnTo: `/car/${car.slug}` });
  const save = page.getByRole('button', { name: /^Save 2023 Tata Nexon/ }).first();
  await save.click();
  await page
    .waitForFunction(
      () => [...document.querySelectorAll('button[aria-pressed="true"]')].length > 0,
      null,
      { timeout: 8000 },
    )
    .catch(() => null);
  const user = await h.one(`SELECT id FROM users WHERE phone=$1`, [phone]);
  const saved1 = await h.one(
    `SELECT count(*)::int n FROM saved_vehicles s JOIN listings l ON l.id=s."listingId" WHERE s."customerId"=$1 AND l.id=$2`,
    [user.id, car.listingId],
  );
  await page.getByRole('button', { name: /account menu/i }).click();
  await page.getByRole('menuitem', { name: 'Logout' }).click();
  await page.waitForLoadState('networkidle');
  await b.uiLogin(page, { phone, name: 'unused', returnTo: '/saved' });
  const savedListed = await page.locator(`a[href="/car/${car.slug}"]`).count();
  await page.goto(`${b.WEB}/car/${car.slug}?enquire=1`, { waitUntil: 'networkidle' });
  await page.locator('textarea[name=message]').fill('Golden two: still available?');
  await page.getByRole('button', { name: 'Send enquiry' }).click();
  await page.waitForLoadState('networkidle');
  await b.sleep(800);
  await page.getByRole('button', { name: /account menu/i }).click();
  await page.getByRole('menuitem', { name: 'Logout' }).click();
  await page.waitForLoadState('networkidle');
  await b.uiLogin(page, { phone, name: 'unused', returnTo: '/enquiries' });
  const enquiryListed = await page.getByText('2023 Tata Nexon').count();
  await b.shot(page, 'GOLDEN-002-enquiries-after-relogin');
  await ctx.close();
  const accounts = await h.one(`SELECT count(*)::int n FROM users WHERE phone=$1`, [phone]);
  r.ev({ saved1: saved1.n, savedListed, enquiryListed, accounts: accounts.n });
  h.assert(
    saved1.n === 1 && savedListed > 0 && enquiryListed > 0 && accounts.n === 1,
    'persistence',
  );
  return {
    layers: ['BROWSER', 'DATABASE'],
    auth: 'FAKE-OTP',
    note: 'OTP sign-up → Save (1 row) → Logout → OTP sign-in (same account, no duplicate user) → /saved lists the car → enquiry → Logout → sign-in → /enquiries still lists it',
  };
});

await h.check(r, 'GOLDEN-003', async () => {
  const D = await w.onboard('Golden3');
  const actx = await b.context({ cookie: admin.cookie });
  const a = await b.open(actx, `/admin/dealers/${D.dealerId}`);
  for (let i = 0; i < 3; i++) {
    await a.page.getByRole('button', { name: 'Verify', exact: true }).first().click();
    if (await a.page.getByRole('dialog').count()) await dialogConfirm(a.page, /verify/i);
    await a.page.waitForLoadState('networkidle');
    await b.sleep(600);
  }
  const brand = await h.one(`SELECT "brandName" FROM dealers WHERE id=$1`, [D.dealerId]);
  await a.page.getByLabel(/Confirm approval/).fill(`approve ${brand.brandName.toLowerCase()}`);
  await a.page.getByRole('button', { name: 'Approve dealer' }).click();
  await a.page.waitForLoadState('networkidle');
  await b.sleep(1000);
  const dealer = await h.one(`SELECT status FROM dealers WHERE id=$1`, [D.dealerId]);
  h.assert(dealer.status === 'ACTIVE', `dealer ${dealer.status}`);
  const s = await w.submitted(D, vehicle(`G3${h.nonce().slice(0, 5)}`));
  for (let i = 1; i <= 6; i++) await w.addImage(admin, s.listingId, i);
  const l = await b.open(actx, `/admin/listings/${s.listingId}`);
  const checks = l.page.getByRole('button', { name: 'Mark checked' });
  while (await checks.count()) {
    await checks.first().click();
    await l.page.waitForLoadState('networkidle');
    await b.sleep(300);
  }
  await l.page.getByRole('button', { name: 'Approve and publish' }).click();
  if (await l.page.getByRole('dialog').count()) await dialogConfirm(l.page, /approve|publish/i);
  await l.page.waitForLoadState('networkidle');
  await b.sleep(1000);
  h.assert((await listingOf(s.listingId)).status === 'ACTIVE', 'listing ACTIVE');
  const slug = (await h.one(`SELECT slug FROM listings WHERE id=$1`, [s.listingId])).slug;
  const pub1 = (await h.call('GET', `/v1/vehicles/${slug}`)).status;
  const buyer = await h.customer('Golden3 Buyer');
  const e = await buyer.post('/v1/enquiries', {
    listingSlug: slug,
    message: 'Golden three enquiry',
  });
  const dctx = await b.context({ cookie: D.cookie });
  const d = await b.open(dctx, '/dealer/inventory');
  await d.page.getByRole('button', { name: 'Mark sold' }).first().click();
  await dialogConfirm(d.page, 'Mark sold');
  await dctx.close();
  await actx.close();
  const final = await listingOf(s.listingId);
  const pub2 = (await h.call('GET', `/v1/vehicles/${slug}`)).status;
  const eAfter = await enquiryOf(e.json.id);
  const custSees = (await buyer.get('/v1/enquiries')).json.data.some((x) => x.id === e.json.id);
  const trail = await audits(s.listingId);
  r.ev({
    dealer: dealer.status,
    listing: final.status,
    pub1,
    pub2,
    enquiry: eAfter.status,
    custSees,
    trail,
  });
  h.assert(final.status === 'SOLD' && pub1 === 200 && pub2 === 404 && custSees, 'sold + history');
  return {
    layers: ['BROWSER', 'API', 'DATABASE'],
    auth: 'SIM-GOOGLE',
    note: `onboarding (API, SIM-GOOGLE) → Admin UI verifies 3 documents + typed-confirmation Approve → ACTIVE → listing (API details, 6 photos) → Admin UI checks + "Approve and publish" → public 200 → enquiry → dealer UI "Mark sold" confirm → SOLD, public 404, customer still sees enquiry (${eAfter.status}); listing audit ${JSON.stringify(trail)}. ${HYBRID}`,
  };
});

await h.check(r, 'GOLDEN-004', async () => {
  const D = await liveDealer('Golden4');
  const invitee = await h.customer('Golden4 Invitee');
  const octx = await b.context({ cookie: D.cookie });
  const o = await b.open(octx, '/dealer/team');
  await o.page.getByRole('button', { name: 'Invite member' }).click();
  const dlg = o.page.getByRole('dialog');
  await dlg.getByLabel(/mobile number/i).fill(invitee.phone.replace('+91', ''));
  const roleSel = dlg.locator('select').first();
  if (await roleSel.count()) await roleSel.selectOption('STAFF');
  else
    await dlg
      .getByRole('radio', { name: /staff/i })
      .check()
      .catch(() => null);
  await dlg.getByRole('button', { name: 'Invite', exact: true }).click();
  await dlg.waitFor({ state: 'detached' });
  const inv = await h.one(
    `SELECT id, role, status FROM dealer_invitations WHERE "dealerId"=$1 ORDER BY "createdAt" DESC LIMIT 1`,
    [D.dealerId],
  );
  const ictx = await b.context({ cookie: invitee.cookie });
  const i = await b.open(ictx, '/invitations');
  await i.page.getByRole('button', { name: 'Accept and open dealer dashboard' }).click();
  await i.page.waitForURL((u) => u.pathname === '/dealer', { timeout: 15000 });
  const landed = new URL(i.page.url()).pathname;
  await ictx.close();
  const member = await h.one(
    `SELECT role, status FROM dealer_members WHERE "dealerId"=$1 AND "userId"=$2`,
    [D.dealerId, invitee.userId],
  );
  invitee.dealerId = D.dealerId;
  const draftId = await w.draft(invitee, vehicle(`G4${h.nonce().slice(0, 5)}`));
  const staffSubmit = await invitee.post(`/v1/dealer/vehicles/${draftId}/submit`);
  const ownerSubmit = await D.post(`/v1/dealer/vehicles/${draftId}/submit`);
  const listingId = ownerSubmit.json?.listing?.id;
  await w.approveListing(admin, listingId);
  const final = await listingOf(listingId);
  await octx.close();
  r.ev({
    inv,
    landed,
    member,
    staffSubmit: staffSubmit.status,
    ownerSubmit: ownerSubmit.status,
    final: final.status,
  });
  h.assert(
    inv.role === 'STAFF' &&
      landed === '/dealer' &&
      member.status === 'ACTIVE' &&
      member.role === 'STAFF' &&
      staffSubmit.status === 403 &&
      ownerSubmit.status === 200 &&
      final.status === 'ACTIVE',
    'journey',
  );
  return {
    layers: ['BROWSER', 'API', 'DATABASE'],
    auth: 'FAKE-OTP',
    note: 'OWNER invites STAFF in the UI dialog → existing customer accepts on /invitations → lands on /dealer with the same session (no re-login) → STAFF drafts (API) → STAFF submit 403 → OWNER submit 200 → Admin approve → ACTIVE',
  };
});

await h.check(r, 'GOLDEN-005', async () => {
  const D = await liveDealer('Golden5');
  const manager = await w.addMember(D, 'MANAGER', 'Golden5 Manager');
  const mctx = await b.context({ cookie: manager.cookie });
  const p = await b.open(mctx, '/saved');
  await p.page.getByRole('button', { name: /account menu/i }).click();
  await p.page.getByRole('menuitem', { name: /Golden5/ }).click();
  await p.page.waitForURL((u) => u.pathname.startsWith('/dealer'), { timeout: 15000 });
  const switched = new URL(p.page.url()).pathname;
  const s = await w.submitted(manager, vehicle(`G5${h.nonce().slice(0, 5)}`));
  await w.approveListing(admin, s.listingId);
  const slug = (await h.one(`SELECT slug FROM listings WHERE id=$1`, [s.listingId])).slug;
  const buyer = await h.customer('Golden5 Buyer');
  const e = await buyer.post('/v1/enquiries', {
    listingSlug: slug,
    message: 'Golden five enquiry',
  });
  await p.page.goto(`${b.WEB}/dealer/enquiries`, { waitUntil: 'networkidle' });
  await p.page.getByRole('button', { name: 'Mark contacted' }).first().click();
  await p.page.waitForLoadState('networkidle');
  await b.sleep(600);
  await p.page.goto(`${b.WEB}/dealer/enquiries?status=CONTACTED`, { waitUntil: 'networkidle' });
  await p.page.getByRole('button', { name: 'Close' }).first().click();
  if (await p.page.getByRole('dialog').count()) await dialogConfirm(p.page, /close/i);
  await b.sleep(600);
  await p.page.goto(`${b.WEB}/dealer/inventory`, { waitUntil: 'networkidle' });
  await p.page.getByRole('button', { name: 'Mark sold' }).first().click();
  await dialogConfirm(p.page, 'Mark sold');
  await mctx.close();
  const eAfter = await enquiryOf(e.json.id);
  const final = await listingOf(s.listingId);
  r.ev({ switched, enquiry: eAfter.status, listing: final.status });
  h.assert(
    switched.startsWith('/dealer') && eAfter.status === 'CLOSED' && final.status === 'SOLD',
    'journey',
  );
  return {
    layers: ['BROWSER', 'API', 'DATABASE'],
    auth: 'FAKE-OTP',
    note: 'MANAGER in personal customer context → account menu switches to the dealership (same session) → submits listing → Admin approve → enquiry Mark contacted → Close → inventory Mark sold (confirm) → enquiry CLOSED, listing SOLD',
  };
});

await h.check(r, 'GOLDEN-006', async () => {
  const D = await liveDealer('Golden6');
  const staff = await w.addMember(D, 'STAFF', 'Golden6 Staff');
  const pubCar = await w.published(D, admin, vehicle(`G6${h.nonce().slice(0, 5)}`));
  const buyer = await h.customer('Golden6 Buyer');
  const e = await buyer.post('/v1/enquiries', {
    listingSlug: pubCar.slug,
    message: 'Golden six enquiry',
  });
  staff.dealerId = D.dealerId;
  const draftId = await w.draft(staff, vehicle(`G6d${h.nonce().slice(0, 4)}`));
  const sctx = await b.context({ cookie: staff.cookie });
  const s = await b.open(sctx, '/dealer/enquiries');
  const visible = {
    close: await s.page.getByRole('button', { name: 'Close' }).count(),
    spam: await s.page.getByRole('button', { name: 'Spam' }).count(),
  };
  await s.page.getByRole('button', { name: 'Mark contacted' }).first().click();
  await s.page.waitForLoadState('networkidle');
  await b.sleep(600);
  const inv = await b.open(sctx, '/dealer/inventory');
  const invButtons = {
    sold: await inv.page.getByRole('button', { name: 'Mark sold' }).count(),
    withdraw: await inv.page.getByRole('button', { name: 'Withdraw' }).count(),
  };
  const team = await b.open(sctx, '/dealer/team');
  const teamUrl = new URL(team.page.url()).pathname;
  const invite = await team.page.getByRole('button', { name: 'Invite member' }).count();
  await sctx.close();
  const denied = {
    close: (await staff.patch(`/v1/dealer/enquiries/${e.json.id}`, { status: 'CLOSED' })).status,
    submit: (await staff.post(`/v1/dealer/vehicles/${draftId}/submit`)).status,
    sold: (await staff.post(`/v1/dealer/vehicles/${pubCar.vehicleId}/mark-sold`)).status,
    withdraw: (
      await staff.post(`/v1/dealer/vehicles/${pubCar.vehicleId}/withdraw`, {
        reason: 'NO_LONGER_FOR_SALE',
      })
    ).status,
    delete: (await staff.del(`/v1/dealer/vehicles/${draftId}`)).status,
    invite: (
      await staff.post('/v1/dealer/team/invitations', { phone: b.freshPhone('90'), role: 'STAFF' })
    ).status,
    profile: (await staff.patch('/v1/dealer', { tagline: 'Staff should not edit this tagline' }))
      .status,
  };
  const state = {
    enquiry: (await enquiryOf(e.json.id)).status,
    car: (await listingOf(pubCar.listingId)).status,
    draft: (await h.q(`SELECT 1 FROM vehicles WHERE id=$1`, [draftId])).length,
  };
  r.ev({ visible, invButtons, teamUrl, invite, denied, state });
  h.assert(
    state.enquiry === 'CONTACTED' &&
      Object.values(denied).every((x) => x === 403) &&
      state.car === 'ACTIVE' &&
      state.draft === 1,
    `denials ${JSON.stringify(denied)} state ${JSON.stringify(state)}`,
  );
  return {
    layers: ['BROWSER', 'API', 'DATABASE'],
    auth: 'FAKE-OTP',
    note: `STAFF drafts and marks CONTACTED in the UI; UI shows Close×${visible.close}, Spam×${visible.spam}, Mark sold×${invButtons.sold}, Withdraw×${invButtons.withdraw}, Invite×${invite}; every privileged API attempt → 403 ${JSON.stringify(denied)}; DB unchanged (car ACTIVE, draft kept)`,
  };
});

await h.check(r, 'GOLDEN-007', async () => {
  const D = await liveDealer('Golden7');
  const staff = await w.addMember(D, 'STAFF', 'Golden7 Staff');
  const sctx = await b.context({ cookie: staff.cookie });
  const before = await b.open(sctx, '/dealer/enquiries');
  const beforeUrl = new URL(before.page.url()).pathname;
  const octx = await b.context({ cookie: D.cookie });
  const o = await b.open(octx, '/dealer/team');
  await o.page
    .getByRole('button', { name: /remove/i })
    .first()
    .click();
  await dialogConfirm(o.page, /remove/i);
  await octx.close();
  const member = await h.one(
    `SELECT status FROM dealer_members WHERE "dealerId"=$1 AND "userId"=$2`,
    [D.dealerId, staff.userId],
  );
  await before.page.reload({ waitUntil: 'networkidle' });
  const afterUrl = new URL(before.page.url()).pathname;
  const api = (await staff.get('/v1/dealer/enquiries')).status;
  const saved = await b.open(sctx, '/saved');
  const savedUrl = new URL(saved.page.url()).pathname;
  const me = (await staff.get('/v1/auth/customer/me')).status;
  await sctx.close();
  r.ev({ beforeUrl, member: member.status, afterUrl, api, savedUrl, me });
  h.assert(
    beforeUrl === '/dealer/enquiries' &&
      member.status === 'REMOVED' &&
      !afterUrl.startsWith('/dealer') &&
      api === 401 &&
      savedUrl === '/saved' &&
      me === 200,
    'revocation',
  );
  return {
    layers: ['BROWSER', 'API', 'DATABASE'],
    auth: 'FAKE-OTP',
    note: `OWNER removes STAFF in the UI (confirm) → member REMOVED → the STAFF's already-open dealer tab reloads to ${afterUrl} (no dealer data); dealer API 401; same session still works as a customer (/saved 200, /me 200)`,
  };
});

await h.check(r, 'GOLDEN-008', async () => {
  const D = await liveDealer('Golden8');
  const car = await w.published(D, admin, vehicle(`G8${h.nonce().slice(0, 5)}`));
  const buyer = await h.customer('Golden8 Buyer');
  const e = await buyer.post('/v1/enquiries', {
    listingSlug: car.slug,
    message: 'Golden eight enquiry',
  });
  const actx = await b.context({ cookie: admin.cookie });
  const a = await b.open(actx, `/admin/dealers/${D.dealerId}`);
  await a.page.getByLabel('Reason for suspension').fill('Golden journey suspension check');
  await a.page.getByRole('button', { name: 'Suspend', exact: true }).click();
  if (await a.page.getByRole('dialog').count()) await dialogConfirm(a.page, /suspend/i);
  await a.page.waitForLoadState('networkidle');
  await b.sleep(800);
  const suspended = (await h.one(`SELECT status FROM dealers WHERE id=$1`, [D.dealerId])).status;
  const during = {
    car: (await h.call('GET', `/v1/vehicles/${car.slug}`)).status,
    dealer: (await h.call('GET', `/v1/dealers/${D.slug}`)).status,
    dealerApi: (await D.get('/v1/dealer/enquiries')).status,
    customerSees: (await buyer.get('/v1/enquiries')).json.data.some((x) => x.id === e.json.id),
    listing: (await listingOf(car.listingId)).status,
  };
  const pctx = await b.context();
  const pub = await b.open(pctx, `/car/${car.slug}`);
  await pctx.close();
  await a.page.reload({ waitUntil: 'networkidle' });
  const reason = a.page.getByLabel(/reason/i).first();
  if (await reason.isVisible().catch(() => false))
    await reason.fill('Golden journey reinstatement');
  await a.page
    .getByRole('button', { name: /reinstate/i })
    .first()
    .click();
  if (await a.page.getByRole('dialog').count())
    await dialogConfirm(a.page, /reinstate/i, { reason: 'Golden journey reinstatement' });
  await a.page.waitForLoadState('networkidle');
  await b.sleep(800);
  await actx.close();
  const after = {
    dealer: (await h.one(`SELECT status FROM dealers WHERE id=$1`, [D.dealerId])).status,
    car: (await h.call('GET', `/v1/vehicles/${car.slug}`)).status,
    listing: (await listingOf(car.listingId)).status,
    enquiry: (await enquiryOf(e.json.id)).status,
    dealerApi: (await D.get('/v1/dealer/enquiries')).status,
  };
  r.ev({ suspended, during, publicPage: pub.status, after });
  h.assert(
    suspended === 'SUSPENDED' &&
      during.car === 404 &&
      during.dealer === 404 &&
      pub.status === 404 &&
      during.customerSees &&
      after.dealer === 'ACTIVE' &&
      after.car === 200 &&
      after.listing === 'ACTIVE' &&
      after.enquiry === 'NEW',
    'suspend/reinstate',
  );
  return {
    layers: ['BROWSER', 'API', 'DATABASE'],
    note: `Admin UI suspend (reason) → SUSPENDED: car/dealer public 404 (web page ${pub.status}), listing kept ${during.listing}, dealer console API ${during.dealerApi}, customer still sees the enquiry → Admin UI reinstate → ACTIVE, car public 200, listing ACTIVE, enquiry ${after.enquiry} intact`,
  };
});

await h.check(r, 'GOLDEN-009', async () => {
  const A = await liveDealer('Golden9Employer');
  const B = await liveDealer('Golden9Other');
  const bCar = await w.published(B, admin, vehicle(`G9${h.nonce().slice(0, 5)}`));
  const member = await w.addMember(A, 'MANAGER', 'Golden9 Member');
  const aBefore = (await A.get('/v1/dealer/enquiries')).json.data.length;
  const ctx = await b.context({ cookie: member.cookie });
  const { page } = await b.open(ctx, `/car/${bCar.slug}?enquire=1`);
  await page.locator('textarea[name=message]').fill('Personal enquiry from a dealer employee');
  await page.getByRole('button', { name: 'Send enquiry' }).click();
  await page.waitForLoadState('networkidle');
  await b.sleep(800);
  const mine = await b.open(ctx, '/enquiries');
  const listedPersonally = await mine.page.getByText('2023 Tata Nexon').count();
  await ctx.close();
  const aAfter = (await A.get('/v1/dealer/enquiries')).json.data;
  const bInbox = (await B.get('/v1/dealer/enquiries')).json.data;
  const row = await h.one(
    `SELECT e."dealerId", e."customerId" FROM enquiries e JOIN listings l ON l.id=e."listingId" WHERE l.id=$1 ORDER BY e."createdAt" DESC LIMIT 1`,
    [bCar.listingId],
  );
  const bSeesEmployer = JSON.stringify(bInbox).includes('Golden9Employer');
  r.ev({
    aBefore,
    aAfter: aAfter.length,
    bInbox: bInbox.length,
    row,
    listedPersonally,
    bSeesEmployer,
  });
  h.assert(
    aAfter.length === aBefore &&
      row.dealerId === B.dealerId &&
      row.customerId === member.userId &&
      listedPersonally > 0 &&
      !bSeesEmployer,
    'isolation',
  );
  return {
    layers: ['BROWSER', 'API', 'DATABASE'],
    auth: 'FAKE-OTP',
    note: 'a MANAGER of dealership A, browsing as a customer, enquires on dealership B’s car in the UI → enquiry belongs to B and to the person; A’s inbox unchanged; B’s inbox carries no employer (A) data; the person sees it under My enquiries',
  };
});

await h.check(r, 'GOLDEN-010', async () => {
  const D = await liveDealer('Golden10');
  const car = await w.published(D, admin, vehicle(`G10${h.nonce().slice(0, 5)}`));
  const buyer = await h.customer('Golden10 Buyer');
  const e = await buyer.post('/v1/enquiries', {
    listingSlug: car.slug,
    message: 'Golden ten enquiry',
  });
  const dctx = await b.context({ cookie: D.cookie });
  const d = await b.open(dctx, '/dealer/inventory');
  await d.page.getByRole('button', { name: 'Mark reserved' }).first().click();
  if (await d.page.getByRole('dialog').count()) await dialogConfirm(d.page, /reserve/i);
  await d.page.waitForLoadState('networkidle');
  await b.sleep(800);
  const reserved = (await listingOf(car.listingId)).status;
  const pctx = await b.context();
  const p1 = await b.open(pctx, `/car/${car.slug}`);
  const reservedText = await p1.page.evaluate(
    () => document.querySelector('main')?.innerText ?? '',
  );
  const enquireOnReserved = await p1.page.getByRole('button', { name: 'Enquire now' }).count();
  await b.shot(p1.page, 'GOLDEN-010-reserved');
  const newEnquiry = (
    await (
      await h.customer('Golden10 Late')
    ).post('/v1/enquiries', { listingSlug: car.slug, message: 'Is it still reserved?' })
  ).status;
  await d.page.goto(`${b.WEB}/dealer/inventory?status=RESERVED`, { waitUntil: 'networkidle' });
  await d.page.getByRole('button', { name: 'Mark sold' }).first().click();
  await dialogConfirm(d.page, 'Mark sold');
  await dctx.close();
  const p2page = await pctx.newPage();
  const p2resp = await p2page.goto(`${b.WEB}/car/${car.slug}`, { waitUntil: 'load' });
  const p2 = { status: p2resp?.status() ?? 0 };
  await pctx.close();
  const sold = (await listingOf(car.listingId)).status;
  const trail = await audits(car.listingId);
  const custSees = (await buyer.get('/v1/enquiries')).json.data.some((x) => x.id === e.json.id);
  const sitemap = (await h.call('GET', '/v1/sitemap')).json.vehicles.some(
    (x) => x.slug === car.slug,
  );
  r.ev({
    reserved,
    reservedPage: p1.status,
    reservedBadge: /reserved/i.test(reservedText),
    enquireOnReserved,
    newEnquiry,
    sold,
    soldPage: p2.status,
    trail,
    custSees,
    sitemap,
  });
  h.assert(
    reserved === 'RESERVED' &&
      p1.status === 200 &&
      /reserved/i.test(reservedText) &&
      sold === 'SOLD' &&
      p2.status === 404 &&
      custSees &&
      !sitemap,
    'lifecycle',
  );
  return {
    layers: ['BROWSER', 'API', 'DATABASE'],
    note: `dealer UI Mark reserved → RESERVED: public page 200 with a Reserved notice (Enquire button ×${enquireOnReserved}; new enquiry → ${newEnquiry}) → Mark sold (confirm) → SOLD: public 404, out of the sitemap; customer’s enquiry history kept; audit ${JSON.stringify(trail)}`,
  };
});

r.save();
await b.close();
process.exit(0);
