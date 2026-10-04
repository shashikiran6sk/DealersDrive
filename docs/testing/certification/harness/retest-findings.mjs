// Re-verification on main (f74401a) of every open non-canonical finding — the
// original auditor's and Agent 2's — by reproduction, not by reading a report.
import * as b from './bkit.mjs';
import * as h from './lib.mjs';
import * as w from './world.mjs';

const r = h.recorder('retest-findings');
const admin = await h.admin('cert-admin@example.test');

await h.check(r, 'ORIG-DISC-PROFILE-001 second profile edit', async () => {
  const D = await w.onboard('ProfileTwice');
  await w.approveDealer(admin, D.dealerId);
  const first = await D.patch('/v1/dealer', {
    tagline: 'First edit waiting for moderation review',
  });
  const second = await D.patch('/v1/dealer', {
    tagline: 'Second edit while the first one is pending',
  });
  const pending = await h
    .q(`SELECT status FROM dealer_profile_changes WHERE "dealerId"=$1`, [D.dealerId])
    .catch(() => []);
  r.ev(first, second, { pending: pending.map((x) => x.status) });
  return second.status === 409
    ? {
        status: 'FAIL',
        note: `first edit ${first.status}; second edit while pending → 409 ${second.json?.code} instead of amending the pending change (code/docs say it amends). Still reproduces on main. P3.`,
      }
    : { note: `second edit ${second.status}` };
});

await h.check(r, 'ORIG-GAP-CLOSE no closure path for DRAFT/in-review dealerships', async () => {
  const draftOwner = await h.dealerPhone('CloseGap Owner');
  await h.simulateGoogleLink(draftOwner.userId, `closegap.${h.nonce()}@example.test`);
  const ob = await draftOwner.post('/v1/auth/onboarding', {
    fullName: 'CloseGap Owner',
    phone: draftOwner.phone,
    legalName: `CloseGap ${h.nonce()}`,
    addressLine: '1 Road',
    city: 'Vellore',
    district: 'Vellore',
    state: 'Tamil Nadu',
    pincode: '632001',
    tagline: 'A draft dealership used for closure checks',
    specialities: ['SUVs'],
    mapsUrl: 'https://maps.app.goo.gl/abcdEFGH1234',
  });
  const id = ob.json.dealer.id;
  const suspend = await admin.post(`/v1/admin/dealers/${id}/suspend`, {
    reason: 'Close this draft application',
  });
  const close = await admin.post(`/v1/admin/dealers/${id}/close`, {
    reason: 'Close this draft application',
  });
  const routes = (await h.call('GET', '/api/docs/openapi.json')).json?.paths ?? {};
  const closeRoutes = Object.keys(routes).filter(
    (p) => /close|deactivat/i.test(p) && /admin\/dealers|dealer\b/.test(p),
  );
  const closed = await h.one(`SELECT count(*)::int n FROM dealers WHERE status='CLOSED'`);
  r.ev(suspend, close, { closeRoutes, closedDealers: closed.n });
  return {
    status: 'FAIL',
    note: `DRAFT dealership: suspend → ${suspend.status} ${suspend.json?.code ?? ''} (correctly refused since #232), no close route (${close.status}; OpenAPI dealer close/deactivate paths: ${closeRoutes.length}); CLOSED dealers in DB: ${closed.n}. The only way to drop a draft/in-review application is reject = permanent purge. Product gap vs owner expectation (close while DRAFT/PENDING; suspend only once ACTIVE). P2 product decision.`,
  };
});

await h.check(r, 'BUG-NEW-006 onboarding account overflow on mobile', async () => {
  const owner = await h.dealerPhone('Onboarding Mobile Owner With A Long Name');
  await h.simulateGoogleLink(
    owner.userId,
    `a.very.long.onboarding.address.for.layout.${h.nonce()}@example.test`,
  );
  const out = [];
  for (const width of [320, 390]) {
    const ctx = await b.context({
      cookie: owner.cookie,
      viewport: { width, height: 844 },
      mobile: true,
    });
    const { page, status } = await b.open(ctx, '/dealer/onboarding');
    const f = await b.facts(page);
    out.push({ width, status, url: f.url, overflow: f.overflow, h1: f.h1 });
    await b.shot(page, `BUG-NEW-006-onboarding-${width}`);
    await ctx.close();
  }
  r.ev({ out });
  const bad = out.filter((x) => x.overflow > 0);
  return bad.length
    ? {
        status: 'FAIL',
        layers: ['BROWSER'],
        note: `onboarding at ${bad.map((x) => `${x.width}px: +${x.overflow}px`).join(', ')} horizontal overflow (long Google email in the account step). Confirmed. P2.`,
      }
    : { layers: ['BROWSER'], note: `no overflow ${JSON.stringify(out)}` };
});

await h.check(r, 'BUG-NEW-008 local private PDF served as image/jpeg', async () => {
  const D = await w.onboard('PdfMime');
  const detail = await admin.get(`/v1/admin/dealers/${D.dealerId}`);
  const urls = JSON.stringify(detail.json).match(/https?:\/\/[^"]+\/private\?[^"]+/g) ?? [];
  const results = [];
  for (const u of urls.slice(0, 3)) {
    const res = await fetch(u.replace(/^https?:\/\/[^/]+/, h.API));
    const buf = Buffer.from(await res.arrayBuffer());
    results.push({
      status: res.status,
      type: res.headers.get('content-type'),
      isPdf: buf.subarray(0, 4).toString() === '%PDF',
    });
  }
  r.ev({ results });
  const wrong = results.filter((x) => x.isPdf && !/pdf/.test(x.type ?? ''));
  return wrong.length
    ? {
        status: 'FAIL',
        note: `${wrong.length}/${results.length} signed private KYC reads return PDF bytes with Content-Type ${wrong[0].type} (local adapter infers type from the extension-less key). Confirmed on the local driver; R2 not tested. P2 (P3 if R2 sets the stored type correctly).`,
      }
    : { note: `types ${JSON.stringify(results)}` };
});

await h.check(r, 'BUG-NEW-010 warmed car page survives dealer suspension', async () => {
  const D = await w.onboard('WarmCache');
  await w.approveDealer(admin, D.dealerId);
  const car = await w.published(D, admin);
  const ctx = await b.context();
  const first = await b.open(ctx, `/car/${car.slug}`);
  await first.page.reload({ waitUntil: 'networkidle' });
  const sus = await admin.post(`/v1/admin/dealers/${D.dealerId}/suspend`, {
    reason: 'Warm cache suspension check',
  });
  const api = (await h.call('GET', `/v1/vehicles/${car.slug}`)).status;
  const page2 = await ctx.newPage();
  const resp = await page2.goto(`${b.WEB}/car/${car.slug}`, { waitUntil: 'load' });
  const after = resp.status();
  await b.sleep(65000);
  const page3 = await ctx.newPage();
  const later = (await page3.goto(`${b.WEB}/car/${car.slug}`, { waitUntil: 'load' })).status();
  const page4 = await ctx.newPage();
  const later2 = (await page4.goto(`${b.WEB}/car/${car.slug}`, { waitUntil: 'load' })).status();
  await ctx.close();
  r.ev(sus, { api, webImmediately: after, webAfter65s: later, webAfter65sSecond: later2 });
  return after === 200 && api === 404
    ? {
        status: 'FAIL',
        layers: ['BROWSER', 'API'],
        note: `after Admin suspension the API returns ${api} but the warmed car page still returns ${after}; after 65 s: ${later} then ${later2} (ISR revalidate=60 serves stale once, then refreshes). Suspension does not revalidate the vehicle tag. Confirmed. P2.`,
      }
    : { layers: ['BROWSER', 'API'], note: `api ${api} web ${after}/${later}/${later2}` };
});

await h.check(r, 'BUG-NEW-011 media width contract vs documentation', async () => {
  const media = await h.one(
    `SELECT m.id FROM media m JOIN listings l ON l."dealerId"=m."dealerId" JOIN dealers d ON d.id=l."dealerId" WHERE m."ownerType"='VEHICLE' AND m.status='READY' AND l.status='ACTIVE' AND d.status='ACTIVE' LIMIT 1`,
  );
  const widths = {};
  for (const wd of [320, 500, 4000, 4001])
    widths[wd] = (await fetch(`${h.API}/media/by-media/${media.id}/${wd}.webp`)).status;
  const doc = JSON.stringify(
    (await h.call('GET', '/api/docs/openapi.json')).json?.paths?.[
      '/media/by-media/{mediaId}/{width}.webp'
    ] ?? {},
  );
  const docSaysFixed = /320, 640, 1024 and 1600/.test(doc);
  r.ev({ widths, docSaysFixed });
  return widths[500] === 200 && docSaysFixed
    ? {
        status: 'FAIL',
        note: `OpenAPI says only 320/640/1024/1600 (anything else 404) but the route serves ${JSON.stringify(widths)}. Documentation/contract drift. Confirmed. P3.`,
      }
    : { note: JSON.stringify({ widths, docSaysFixed }) };
});

r.save();
await b.close();
process.exit(0);
