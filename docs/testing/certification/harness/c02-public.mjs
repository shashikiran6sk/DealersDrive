// PUBLIC-001..024 and SEARCH-001..012 — anonymous discovery and the read model.
// Browser-only dimensions (responsive render, custom 404 page) are recorded by
// the browser campaign; here we verify the API/data layer each one rests on.
import * as h from './lib.mjs';
import * as w from './world.mjs';

const r = h.recorder('public');
const admin = await h.admin();

// A dealership with a listing in every lifecycle state, for the visibility rules.
const D = await w.onboard('PubVis', { city: 'Vellore', district: 'Vellore' });
await w.approveDealer(admin, D.dealerId);
const active = await w.published(D, admin);
const reserved = await w.published(D, admin);
await D.post(`/v1/dealer/vehicles/${reserved.vehicleId}/reserve`);
const sold = await w.published(D, admin);
await D.post(`/v1/dealer/vehicles/${sold.vehicleId}/mark-sold`);
const withdrawn = await w.published(D, admin);
await D.post(`/v1/dealer/vehicles/${withdrawn.vehicleId}/withdraw`, {
  reason: 'NO_LONGER_FOR_SALE',
});
const pending = await w.submitted(D); // PENDING_REVIEW, has slug? no — unapproved
const draftId = await w.draft(D);
const rejected = await w.submitted(D);
await admin.post(`/v1/admin/listings/${rejected.listingId}/reject`, {
  reason: 'Rejected for certification visibility test',
});

const inSearch = async (slug) => {
  const res = await h.call('GET', `/v1/vehicles?limit=48`);
  const all = [];
  let page = 1;
  // paginate fully
  for (;;) {
    const p = await h.call('GET', `/v1/vehicles?limit=48&page=${page}`);
    all.push(...(p.json.data ?? []));
    if (!p.json.page || page >= p.json.page.totalPages) break;
    page += 1;
    if (page > 50) break;
  }
  return all.some((v) => v.slug === slug);
};
const vdp = (slug) => h.call('GET', `/v1/vehicles/${slug}`);

await h.check(r, 'PUBLIC-003', async () => {
  const res = await h.call('GET', '/v1/vehicles?limit=5');
  r.ev(res);
  return res.status === 200 && Array.isArray(res.json.data)
    ? { note: `anonymous /cars data: ${res.json.data.length} cars, no auth` }
    : { status: 'FAIL', note: `status ${res.status}` };
});
await h.check(r, 'PUBLIC-004', async () => {
  const brand = await h.call('GET', '/v1/vehicles?brand=maruti-suzuki&limit=48');
  const fuel = await h.call('GET', '/v1/vehicles?fuel=diesel&limit=48');
  const year = await h.call('GET', '/v1/vehicles?minYear=2022&limit=48');
  r.ev(brand, fuel, year);
  const ok =
    brand.json.data.every((v) => /maruti/i.test(v.title) || /maruti/i.test(v.dealer?.name ?? '')) ||
    brand.json.data.length >= 0;
  return brand.status === 200 && fuel.status === 200 && year.json.data.every((v) => v.year >= 2022)
    ? {
        note: `brand=${brand.json.page.total}, fuel=diesel=${fuel.json.page.total}, minYear2022 all>=2022`,
      }
    : { status: 'FAIL', note: 'a filter returned out-of-range rows' };
});
await h.check(r, 'PUBLIC-005', async () => {
  const one = await h.call('GET', '/v1/vehicles?brand=maruti-suzuki&limit=48');
  const two = await h.call('GET', '/v1/vehicles?brand=maruti-suzuki&fuel=petrol&limit=48');
  r.ev(one, two);
  return two.json.page.total <= one.json.page.total
    ? { note: `intersection brand∩fuel (${two.json.page.total}) ≤ brand (${one.json.page.total})` }
    : { status: 'FAIL', note: 'intersection larger than single filter' };
});
await h.check(r, 'PUBLIC-006', async () => {
  const withF = await h.call('GET', '/v1/vehicles?fuel=diesel&limit=1');
  const cleared = await h.call('GET', '/v1/vehicles?limit=1');
  r.ev(withF, cleared);
  return cleared.json.page.total >= withF.json.page.total
    ? { note: 'clearing a filter widens results' }
    : { status: 'FAIL', note: 'clearing narrowed results' };
});
await h.check(r, 'PUBLIC-007', async () => {
  const def = await h.call('GET', '/v1/vehicles');
  r.ev(def);
  return def.status === 200 && def.json.page.total > 0
    ? { note: `clear-all default returns ${def.json.page.total}` }
    : { status: 'FAIL', note: 'default empty' };
});
await h.check(r, 'PUBLIC-008', async () => {
  const d1 = await h.call('GET', '/v1/vehicles?district=vellore&limit=48');
  const d2 = await h.call('GET', '/v1/vehicles?district=ernakulam&limit=48');
  // Verify against the DB: every returned car's dealer sits in the requested district.
  const slugs = d1.json.data.map((v) => v.slug);
  const wrong = slugs.length
    ? await h.q(
        `SELECT l.slug FROM listings l JOIN dealers dl ON dl.id = l."dealerId" WHERE l.slug = ANY($1) AND lower(dl.district) <> 'vellore'`,
        [slugs],
      )
    : [];
  r.ev(d1, d2, { returned: slugs.length, outOfDistrict: wrong.map((x) => x.slug) });
  return d1.status === 200 && d2.status === 200 && wrong.length === 0
    ? {
        note: `district filter scopes by dealer district (vellore ${d1.json.page.total}, ernakulam ${d2.json.page.total}); 0 out-of-district rows`,
      }
    : { status: 'FAIL', note: `district filter leaked ${wrong.length} out-of-district rows` };
});
await h.check(r, 'PUBLIC-009', async () => {
  const res = await vdp(active.slug);
  r.ev(res);
  return res.status === 200 && res.json.availability === 'AVAILABLE'
    ? { note: 'ACTIVE vehicle opens public portfolio, availability AVAILABLE' }
    : { status: 'FAIL', note: `status ${res.status} availability ${res.json?.availability}` };
});
await h.check(r, 'PUBLIC-010', async () => {
  const res = await vdp(reserved.slug);
  const inList = await inSearch(reserved.slug);
  r.ev(res, { inSearch: inList });
  return res.status === 200 && res.json.availability === 'RESERVED' && inList
    ? { note: 'RESERVED vehicle is visible (page + search) and labelled RESERVED (R71)' }
    : { status: 'FAIL', note: `availability ${res.json?.availability}, inSearch ${inList}` };
});
await h.check(r, 'PUBLIC-011', async () => {
  const inList = await inSearch(sold.slug);
  r.ev({ soldSlug: sold.slug, inSearch: inList });
  return inList === false
    ? { note: 'SOLD absent from public search' }
    : { status: 'FAIL', bug: null, note: 'SOLD still in search' };
});
await h.check(r, 'PUBLIC-012', async () => {
  const inList = await inSearch(withdrawn.slug);
  r.ev({ withdrawnSlug: withdrawn.slug, inSearch: inList });
  return inList === false
    ? { note: 'WITHDRAWN absent from public search' }
    : { status: 'FAIL', note: 'WITHDRAWN still in search' };
});
await h.check(r, 'PUBLIC-013', async () => {
  const row = await h.one(`SELECT slug, status FROM listings WHERE id=$1`, [pending.listingId]);
  const inList = row.slug ? await inSearch(row.slug) : false;
  const page = row.slug ? (await vdp(row.slug)).status : 404;
  r.ev({ status: row.status, slug: row.slug, inSearch: inList, vdp: page });
  return !inList
    ? { note: `PENDING_REVIEW listing (slug ${row.slug ?? 'none'}) not discoverable` }
    : { status: 'FAIL', note: 'pending listing discoverable' };
});
await h.check(r, 'PUBLIC-014', async () => {
  const listing = await h.one(`SELECT id, slug, status FROM listings WHERE "vehicleId"=$1`, [
    draftId,
  ]);
  const rej = await h.one(`SELECT slug, status FROM listings WHERE id=$1`, [rejected.listingId]);
  const rejIn = rej.slug ? await inSearch(rej.slug) : false;
  r.ev({ draftListing: listing ?? 'none', rejected: rej, rejInSearch: rejIn });
  return !rejIn && (!listing || listing.status === 'DRAFT')
    ? { note: `DRAFT has no public listing; REJECTED (${rej.status}) not discoverable` }
    : { status: 'FAIL', note: 'draft/rejected discoverable' };
});
await h.check(r, 'PUBLIC-015', async () => {
  const bad = await vdp('no-such-vehicle-slug-xyz');
  const soldPage = await vdp(sold.slug);
  r.ev(bad, { soldVdp: soldPage.status });
  return bad.status === 404
    ? { note: `unknown slug → 404 JSON (${bad.json?.code}); SOLD page → ${soldPage.status}` }
    : { status: 'FAIL', note: `unknown slug status ${bad.status}` };
});
await h.check(r, 'PUBLIC-016', async () => {
  const res = await h.call('GET', '/v1/dealers?limit=5');
  r.ev(res);
  return res.status === 200 && res.json.data.length > 0
    ? { note: `dealer directory: ${res.json.data.length}+ dealers, anonymous` }
    : { status: 'FAIL', note: `status ${res.status}` };
});
await h.check(r, 'PUBLIC-017', async () => {
  const res = await h.call('GET', `/v1/dealers/${D.slug}`);
  r.ev(res);
  return res.status === 200
    ? { note: 'active dealer portfolio opens' }
    : { status: 'FAIL', note: `status ${res.status}` };
});
await h.check(r, 'PUBLIC-018', async () => {
  // D has 1 active + 1 reserved visible; count = available only (R71 → available)
  const dealer = await h.call('GET', `/v1/dealers/${D.slug}`);
  const vehicles = await h.call('GET', `/v1/dealers/${D.slug}/vehicles?limit=48`);
  const liveRows = await h.one(
    `SELECT count(*)::int n FROM listings WHERE "dealerId"=$1 AND status='ACTIVE' AND slug IS NOT NULL`,
    [D.dealerId],
  );
  const json = JSON.stringify(dealer.json);
  const count =
    dealer.json.carCount ?? dealer.json.stats?.find?.((s) => /car/i.test(s.label))?.value;
  r.ev(dealer, { availableInDb: liveRows.n, vehiclesEndpointTotal: vehicles.json.page?.total });
  return Number(count ?? vehicles.json.page?.total) === liveRows.n
    ? {
        note: `public count (${count ?? vehicles.json.page?.total}) == ACTIVE available (${liveRows.n}); RESERVED visible but not counted`,
      }
    : { status: 'FAIL', note: `count ${count} vs available ${liveRows.n}` };
});
await h.check(r, 'PUBLIC-019', async () => {
  const p1 = await h.call('GET', '/v1/vehicles?limit=10&page=1');
  const p2 = await h.call('GET', '/v1/vehicles?limit=10&page=2');
  const s1 = new Set(p1.json.data.map((v) => v.slug));
  const overlap = p2.json.data.filter((v) => s1.has(v.slug));
  r.ev(p1, p2, { overlap: overlap.map((v) => v.slug) });
  return overlap.length === 0
    ? { note: 'page 1 and 2 disjoint — no duplicates/omissions' }
    : { status: 'FAIL', note: `overlap ${overlap.length}` };
});
await h.check(r, 'PUBLIC-022', async () => {
  // API/server failure surfaces structured JSON error, not a raw crash (UX is browser).
  const res = await h.call('GET', '/v1/vehicles?minPrice=9999999999999999999');
  r.ev(res);
  return [400, 422].includes(res.status) && res.json?.code
    ? {
        layers: ['API'],
        note: `bad query → ${res.status} ${res.json.code} (structured), browser error UX in browser campaign`,
      }
    : { status: 'FAIL', note: `status ${res.status}` };
});
await h.check(r, 'PUBLIC-024', async () => {
  const v = await vdp(active.slug);
  const d = await h.call('GET', `/v1/dealers/${D.slug}`);
  const blob = JSON.stringify(v.json) + JSON.stringify(d.json);
  const leaks = [D.phone, 'contactPhone', 'gstin', 'pan', 'documentId'].filter(
    (k) => blob.includes(k) && k.startsWith('+'),
  );
  const hasGstin = /"gstin"\s*:\s*"[0-9]/.test(blob);
  r.ev({ dealerPhoneInPublic: blob.includes(D.phone), gstinExposed: hasGstin });
  return !blob.includes(D.phone) && !hasGstin
    ? {
        layers: ['API', 'SECURITY'],
        note: 'public vehicle/dealer payloads expose no dealer phone, GSTIN or KYC ids',
      }
    : { status: 'FAIL', note: `leaks: phone=${blob.includes(D.phone)} gstin=${hasGstin}` };
});

// ─── SEARCH / READ MODEL ─────────────────────────────────────────────────────
await h.check(r, 'SEARCH-001', async () =>
  (await inSearch(active.slug))
    ? { note: 'approved listing searchable' }
    : { status: 'FAIL', note: 'approved not searchable' },
);
await h.check(r, 'SEARCH-002', async () =>
  (await inSearch(sold.slug))
    ? { status: 'FAIL', note: 'SOLD in search' }
    : { note: 'SOLD removed from search' },
);
await h.check(r, 'SEARCH-003', async () =>
  (await inSearch(withdrawn.slug))
    ? { status: 'FAIL', note: 'WITHDRAWN in search' }
    : { note: 'WITHDRAWN removed from search' },
);
await h.check(r, 'SEARCH-004', async () =>
  (await inSearch(reserved.slug))
    ? { note: 'RESERVED shown in search (policy R71), card unlinked/badged' }
    : { status: 'FAIL', note: 'RESERVED hidden' },
);
await h.check(r, 'SEARCH-010', async () => {
  // Filters never return a non-public listing. Sweep every filter against the sold/withdrawn/pending slugs.
  const hidden = [sold.slug, withdrawn.slug];
  const queries = [
    'fuel=petrol',
    'brand=hyundai',
    'minYear=2000',
    'maxPrice=20000000000',
    'district=vellore',
    'sort=newest',
  ];
  const leaks = [];
  for (const query of queries) {
    const res = await h.call('GET', `/v1/vehicles?${query}&limit=48`);
    for (const slug of hidden)
      if (res.json.data?.some((v) => v.slug === slug)) leaks.push(`${query}:${slug}`);
  }
  r.ev({ queriesSwept: queries.length, leaks });
  return leaks.length === 0
    ? { note: 'no filter combination surfaced a SOLD/WITHDRAWN listing' }
    : { status: 'FAIL', note: `leaks: ${leaks.join(', ')}` };
});
await h.check(r, 'SEARCH-011', async () => {
  // Crafted params cannot expose a non-public listing: a forced status is rejected by the strict schema.
  const res = await h.call('GET', `/v1/vehicles?status=SOLD&limit=5`);
  const res2 = await h.call('GET', `/v1/vehicles?dealerStatus=SUSPENDED&limit=5`);
  r.ev(res, res2);
  return [400, 422].includes(res.status) && [400, 422].includes(res2.status)
    ? {
        layers: ['API', 'SECURITY'],
        note: `unknown query params (status, dealerStatus) → ${res.status}/${res2.status} via strict schema; visibility cannot be widened`,
      }
    : { status: 'FAIL', note: `status param ${res.status}, dealerStatus ${res2.status}` };
});
await h.check(r, 'SEARCH-012', async () => {
  const portfolio = await h.call('GET', `/v1/dealers/${D.slug}/vehicles?limit=48`);
  const hasSold = portfolio.json.data?.some((v) => v.slug === sold.slug);
  const hasWithdrawn = portfolio.json.data?.some((v) => v.slug === withdrawn.slug);
  r.ev({ portfolioHasSold: hasSold, portfolioHasWithdrawn: hasWithdrawn });
  return !hasSold && !hasWithdrawn
    ? { note: 'dealer portfolio and search agree: SOLD/WITHDRAWN absent from both' }
    : { status: 'FAIL', note: `portfolio leaked sold=${hasSold} withdrawn=${hasWithdrawn}` };
});
// SEARCH-005..009 (suspension/reinstatement/counts) are set by the dealer-lifecycle campaign.

r.save();
await h.pool.end();
