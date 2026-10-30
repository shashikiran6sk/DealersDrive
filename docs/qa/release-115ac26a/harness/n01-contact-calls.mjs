// CALL-*, LEAD-*, APPR-*, PRIV-* — Call dealer, call leads and admin approval (#346).
// Runs against an API with LEGAL_V1_PREVIEW=true (CERT_API_LEGAL) so the customer
// legal gate is live, as it is in production; rate limits against CERT_API_LEGAL_RL.
import * as h from "./lib.mjs";
import * as w from "./world.mjs";

const API = process.env.CERT_API_LEGAL ?? "http://localhost:4003";
const API_RL = process.env.CERT_API_LEGAL_RL ?? "http://localhost:4004";
const WEB = process.env.CERT_WEB_LEGAL ?? "http://localhost:3004";

const r = h.recorder("contact-calls");
const at = (a, base = API) => ({
  ...a,
  get: (p, o = {}) => h.call("GET", p, { ...o, base, cookie: a.cookie }),
  post: (p, body, o = {}) =>
    h.call("POST", p, { ...o, base, body, cookie: a.cookie }),
  patch: (p, body, o = {}) =>
    h.call("PATCH", p, { ...o, base, body, cookie: a.cookie }),
});
async function dealerTerms(...actors) {
  for (const a of actors) {
    const x = await h.call("POST", "/v1/legal/accept", {
      base: API,
      cookie: a.cookie,
      body: { scope: "DEALER", accepted: true },
    });
    if (x.status !== 200 && x.status !== 201)
      throw new Error(`dealer terms ${x.status} ${x.text}`);
  }
}
async function accepted(name) {
  const c = at(await h.customer(name, h.phone(), API));
  const a = await c.post("/v1/legal/accept", {
    scope: "CUSTOMER",
    accepted: true,
  });
  if (a.status !== 200 && a.status !== 201)
    throw new Error(`legal accept ${a.status} ${a.text}`);
  return c;
}
const reveal = (actor, slug, body = {}, base = API) =>
  h.call("POST", `/v1/vehicles/${slug}/reveal-contact`, {
    base,
    body,
    cookie: actor?.cookie,
  });
const digitsOf = (e164) => e164.replace(/^\+91/, "");

const admin = await h.admin();
const A = at(admin);

const D = await w.onboard("CallMain");
await w.approveDealer(admin, D.dealerId);
const DO = at(D);
const manager = at(await w.addMember(D, "MANAGER", "Call Manager"));
const staff = at(await w.addMember(D, "STAFF", "Call Staff"));
const active = await w.published(D, admin);
const active2 = await w.published(D, admin);
const reserved = await w.published(D, admin);
await D.post(`/v1/dealer/vehicles/${reserved.vehicleId}/reserve`);
const sold = await w.published(D, admin);
await D.post(`/v1/dealer/vehicles/${sold.vehicleId}/mark-sold`);
const withdrawn = await w.published(D, admin);
await D.post(`/v1/dealer/vehicles/${withdrawn.vehicleId}/withdraw`, {
  reason: "NO_LONGER_FOR_SALE",
});
const pendingSlug = withdrawn.slug;

const E = await w.onboard("CallOther");
await w.approveDealer(admin, E.dealerId);
const EO = at(E);
const eCar = await w.published(E, admin);

const N = await w.onboard("CallNone");
await w.approveDealer(admin, N.dealerId);
const nCar = await w.published(N, admin);

await dealerTerms(D, manager, staff, E, N);
const c1 = await accepted("Call Buyer One");
const c2 = await accepted("Call Buyer Two");
const c3 = at(await h.customer("Call Buyer Unaccepted", h.phone(), API));

const D_NUMBER = "044 2345 6789";
const D_E164 = "+914423456789";
const E_NUMBER = "+91 98400 12345";

// ─── before any number is approved ─────────────────────────────────────────
await h.check(r, "CALL-001", async () => {
  const v = await h.call("GET", `/v1/vehicles/${active.slug}`, { base: API });
  r.ev(v);
  return v.status === 200 && v.json.dealer.canCall === false
    ? {
        note: "no approved number → public detail carries canCall:false and no number",
      }
    : {
        status: "FAIL",
        note: `status ${v.status} canCall=${v.json?.dealer?.canCall}`,
      };
});
await h.check(r, "APPR-001", async () => {
  const a = await A.post(
    `/v1/admin/dealers/${D.dealerId}/customer-contact/approve`,
  );
  r.ev(a);
  return a.status === 409 && a.json?.code === "CUSTOMER_CONTACT_MISSING"
    ? { note: "approve with no saved number → 409 CUSTOMER_CONTACT_MISSING" }
    : { status: "FAIL", note: `status ${a.status} ${a.text.slice(0, 200)}` };
});
await h.check(r, "CALL-002", async () => {
  const x = await reveal(c1, nCar.slug);
  r.ev(x);
  return x.status === 404 && x.json?.code === "CONTACT_UNAVAILABLE"
    ? {
        note: "reveal on a dealership with no approved number → 404 CONTACT_UNAVAILABLE",
      }
    : { status: "FAIL", note: `status ${x.status} ${x.text.slice(0, 200)}` };
});

// ─── owner proposes, admin reviews ─────────────────────────────────────────
await h.check(r, "APPR-002", async () => {
  const m = await manager.patch("/v1/dealer", {
    contact: { landline: D_NUMBER },
  });
  const s = await staff.patch("/v1/dealer", {
    contact: { landline: D_NUMBER },
  });
  const rows = await h.q(
    `SELECT id FROM dealer_profile_changes WHERE "dealerId"=$1`,
    [D.dealerId],
  );
  r.ev(m, s);
  return m.status >= 400 && s.status >= 400 && rows.length === 0
    ? {
        note: `manager → ${m.status}, staff → ${s.status}; no profile change filed`,
      }
    : {
        status: "FAIL",
        note: `manager ${m.status} staff ${s.status} rows ${rows.length}`,
      };
});
await h.check(r, "APPR-003", async () => {
  const bad = await DO.patch("/v1/dealer", { contact: { landline: "12345" } });
  const extra = await DO.patch("/v1/dealer", {
    contact: { landline: D_NUMBER, x: 1 },
  });
  r.ev(bad, extra);
  return bad.status === 400 && extra.status === 400
    ? { note: "invalid number and unknown field → 400 naming the field" }
    : { status: "FAIL", note: `bad ${bad.status} extra ${extra.status}` };
});
let changeId = null;
await h.check(r, "APPR-004", async () => {
  const p = await DO.patch("/v1/dealer", { contact: { landline: D_NUMBER } });
  const row = await h.one(
    `SELECT id, landline, "landlineChanged", status FROM dealer_profile_changes WHERE "dealerId"=$1 ORDER BY "createdAt" DESC LIMIT 1`,
    [D.dealerId],
  );
  changeId = row?.id;
  const v = await h.call("GET", `/v1/vehicles/${active.slug}`, { base: API });
  const live = await h.one(
    `SELECT landline, "landlineApprovedAt" FROM dealers WHERE id=$1`,
    [D.dealerId],
  );
  r.ev(p, v);
  return p.status === 200 &&
    row?.status === "PENDING" &&
    row.landline === D_E164 &&
    row.landlineChanged &&
    live.landline === null &&
    v.json.dealer.canCall === false
    ? {
        note: "owner proposal → PENDING change, stored normalised (E.164); live number unchanged and canCall still false",
      }
    : {
        status: "FAIL",
        note: `patch ${p.status} row ${JSON.stringify(row)} live ${JSON.stringify(live)}`,
      };
});
await h.check(r, "APPR-005", async () => {
  const again = await DO.patch("/v1/dealer", {
    contact: { landline: "9840011111" },
  });
  r.ev(again);
  return again.status === 409 && again.json?.code === "PROFILE_EDIT_PENDING"
    ? {
        note: "second proposal while one is pending → 409 PROFILE_EDIT_PENDING",
      }
    : { status: "FAIL", note: `status ${again.status}` };
});
await h.check(r, "APPR-006", async () => {
  const list = await A.get("/v1/admin/profile-changes");
  const ap = await A.post(`/v1/admin/profile-changes/${changeId}/approve`);
  const live = await h.one(
    `SELECT landline, "landlineApprovedAt", "verificationStatus" FROM dealers WHERE id=$1`,
    [D.dealerId],
  );
  const v = await h.call("GET", `/v1/vehicles/${active.slug}`, { base: API });
  r.ev(list, ap, v);
  return ap.status === 200 &&
    live.landline === D_E164 &&
    live.landlineApprovedAt &&
    v.json.dealer.canCall === true
    ? {
        note: "admin approves the profile change → number live and approved; canCall:true",
      }
    : {
        status: "FAIL",
        note: `approve ${ap.status} live ${JSON.stringify(live)}`,
      };
});

// ─── reveal ────────────────────────────────────────────────────────────────
await h.check(r, "CALL-003", async () => {
  const x = await reveal(null, active.slug);
  r.ev(x);
  return x.status === 401
    ? { note: "anonymous reveal → 401" }
    : { status: "FAIL", note: `status ${x.status}` };
});
await h.check(r, "CALL-004", async () => {
  const x = await reveal(c3, active.slug);
  r.ev(x);
  const leads = await h.q(`SELECT 1 FROM call_leads WHERE "customerId"=$1`, [
    c3.userId,
  ]);
  return x.status === 403 && leads.length === 0
    ? {
        note: "signed in but terms not accepted → 403 from the legal gate; no lead",
      }
    : { status: "FAIL", note: `status ${x.status} leads ${leads.length}` };
});
await h.check(r, "CALL-005", async () => {
  const dealerSession = at(D);
  const x = await reveal(dealerSession, active.slug);
  r.ev(x);
  return x.status === 422 && x.json?.code === "ENQUIRY_OWN_LISTING"
    ? {
        note: "the owner’s own session (one identity across audiences) is refused by the own-listing guard → 422",
      }
    : { status: "FAIL", note: `status ${x.status}` };
});
await h.check(r, "CALL-006", async () => {
  const x = await reveal(c1, active.slug);
  const lead = await h.one(
    `SELECT "revealCount", "dealerId" FROM call_leads WHERE "customerId"=$1 AND "listingId"=$2`,
    [c1.userId, active.listingId],
  );
  const auditRow = await h.one(
    `SELECT count(*)::int n FROM audit_logs WHERE action='dealer.contact_revealed' AND "actorId"=$1`,
    [c1.userId],
  );
  r.ev(x);
  const ok =
    x.status === 200 &&
    x.json.phone === D_E164 &&
    x.json.callHref === `tel:${D_E164}` &&
    x.json.phoneDisplay.replace(/\D/g, "").endsWith("4423456789") &&
    x.headers["cache-control"] === "no-store" &&
    lead?.revealCount === 1 &&
    lead.dealerId === D.dealerId &&
    auditRow.n === 1;
  return ok
    ? {
        note: `200 ${x.json.phoneDisplay} (landline shown in mobile grouping — DISC-CALL-001, P3); Cache-Control no-store; one call lead (count 1) and one audit event`,
      }
    : {
        status: "FAIL",
        note: `status ${x.status} cc ${x.headers["cache-control"]} lead ${JSON.stringify(lead)} audit ${auditRow?.n}`,
      };
});
await h.check(r, "CALL-007", async () => {
  const x = await reveal(c1, active.slug, { listingId: active.listingId });
  const raw = await h.call(
    "POST",
    `/v1/vehicles/${active.slug}/reveal-contact`,
    {
      base: API,
      cookie: c1.cookie,
      raw: '{"dealerId":"x"}',
      headers: { "content-type": "application/json" },
    },
  );
  r.ev(x, raw);
  return x.status === 400 && raw.status === 400 && /listingId/.test(x.text)
    ? { note: "any body field → 400 naming it (strict empty body)" }
    : { status: "FAIL", note: `status ${x.status}/${raw.status}` };
});
await h.check(r, "CALL-008", async () => {
  const res = await reveal(c1, reserved.slug);
  const so = await reveal(c1, sold.slug);
  const pe = await reveal(c1, pendingSlug);
  const nf = await reveal(c1, "no-such-car-zz");
  r.ev(res, so, pe, nf);
  const ok =
    res.status === 409 &&
    so.status === 409 &&
    pe.status === 409 &&
    nf.status === 404 &&
    [res, so, pe].every((x) => x.json?.code === "LISTING_NOT_AVAILABLE");
  return ok
    ? {
        note: "reserved, sold, withdrawn → 409 LISTING_NOT_AVAILABLE; unknown slug → 404",
      }
    : {
        status: "FAIL",
        note: `${res.status} ${so.status} ${pe.status} ${nf.status}`,
      };
});
await h.check(r, "CALL-009", async () => {
  const self = await h.customer("Call Manager", manager.phone, API);
  await h.call("POST", "/v1/legal/accept", {
    base: API,
    cookie: self.cookie,
    body: { scope: "CUSTOMER", accepted: true },
  });
  const x = await reveal(self, active.slug);
  r.ev(x);
  return x.status === 422 && x.json?.code === "ENQUIRY_OWN_LISTING"
    ? {
        note: "a member of the dealership revealing its own car's number → 422",
      }
    : { status: "FAIL", note: `status ${x.status} ${x.text.slice(0, 160)}` };
});

// ─── call leads: dedupe, window, concurrency ───────────────────────────────
await h.check(r, "LEAD-001", async () => {
  await reveal(c1, active.slug);
  await reveal(c1, active.slug);
  const rows = await h.q(
    `SELECT "revealCount" FROM call_leads WHERE "customerId"=$1 AND "listingId"=$2`,
    [c1.userId, active.listingId],
  );
  return rows.length === 1 && rows[0].revealCount === 1
    ? { note: "two more reveals within 24 h → still one lead, count 1" }
    : { status: "FAIL", note: JSON.stringify(rows) };
});
await h.check(r, "LEAD-002", async () => {
  await h.q(
    `UPDATE call_leads SET "lastRevealedAt" = now() - interval '25 hours', "firstRevealedAt" = now() - interval '25 hours' WHERE "customerId"=$1 AND "listingId"=$2`,
    [c1.userId, active.listingId],
  );
  await reveal(c1, active.slug);
  const row = await h.one(
    `SELECT "revealCount", "lastRevealedAt" > now() - interval '1 minute' AS fresh, "firstRevealedAt" < now() - interval '24 hours' AS kept FROM call_leads WHERE "customerId"=$1 AND "listingId"=$2`,
    [c1.userId, active.listingId],
  );
  return row.revealCount === 2 && row.fresh && row.kept
    ? {
        note: "reveal after 25 h → count 2, latest time moved, first time kept",
      }
    : { status: "FAIL", note: JSON.stringify(row) };
});
await h.check(r, "LEAD-003", async () => {
  const all = await Promise.all(
    Array.from({ length: 10 }, () => reveal(c2, active2.slug)),
  );
  const rows = await h.q(
    `SELECT "revealCount" FROM call_leads WHERE "customerId"=$1 AND "listingId"=$2`,
    [c2.userId, active2.listingId],
  );
  const codes = [...new Set(all.map((x) => x.status))];
  return codes.length === 1 &&
    codes[0] === 200 &&
    rows.length === 1 &&
    rows[0].revealCount === 1
    ? { note: "10 concurrent reveals → all 200, exactly one lead, count 1" }
    : { status: "FAIL", note: `codes ${codes} rows ${JSON.stringify(rows)}` };
});
await h.check(r, "LEAD-004", async () => {
  await reveal(c2, active.slug);
  const before = await h.one(
    `SELECT count(*)::int n FROM enquiries WHERE "dealerId"=$1`,
    [D.dealerId],
  );
  const inbox = await DO.get("/v1/dealer/enquiries");
  r.ev(inbox);
  return before.n === 0 && inbox.json.data.length === 0
    ? { note: "reveals create no enquiry and nothing in the enquiry inbox" }
    : { status: "FAIL", note: `enquiries ${before.n}` };
});

// ─── call leads: dealer and admin views ────────────────────────────────────
await h.check(r, "LEAD-005", async () => {
  const o = await DO.get("/v1/dealer/call-leads");
  const m = await manager.get("/v1/dealer/call-leads");
  const s = await staff.get("/v1/dealer/call-leads");
  r.ev(o);
  const names = o.json?.data?.map((x) => x.customer.name) ?? [];
  const first = o.json?.data?.[0];
  const ok =
    o.status === 200 &&
    o.json.data.length === 3 &&
    names.includes("Call Buyer One") &&
    names.includes("Call Buyer Two") &&
    first.customer.callHref?.startsWith("tel:+91") &&
    o.json.data.every((x) => x.vehicle.href) &&
    m.status === o.status &&
    [200, 403].includes(s.status);
  return ok
    ? {
        note: `owner sees 3 leads newest first with name and callable mobile; manager ${m.status}; staff ${s.status}`,
      }
    : {
        status: "FAIL",
        note: `owner ${o.status} n=${o.json?.data?.length} m ${m.status} s ${s.status}`,
      };
});
await h.check(r, "LEAD-006", async () => {
  const sorted = (await DO.get("/v1/dealer/call-leads")).json.data.map(
    (x) => x.lastRevealedAt,
  );
  const desc = sorted.every((t, i) => i === 0 || sorted[i - 1] >= t);
  const p1 = await DO.get("/v1/dealer/call-leads?limit=2");
  const p2 = await DO.get(
    `/v1/dealer/call-leads?limit=2&cursor=${encodeURIComponent(p1.json.page.nextCursor)}`,
  );
  const ids = [...p1.json.data, ...p2.json.data].map((x) => x.id);
  const bad = await DO.get("/v1/dealer/call-leads?dealerId=x");
  const badLimit = await DO.get("/v1/dealer/call-leads?limit=500");
  const badCursor = await DO.get("/v1/dealer/call-leads?cursor=garbage");
  r.ev(p1, p2, bad, badLimit, badCursor);
  const ok =
    desc &&
    p1.json.data.length === 2 &&
    p2.json.data.length === 1 &&
    new Set(ids).size === 3 &&
    !p2.json.page.nextCursor &&
    bad.status === 400 &&
    badLimit.status === 400 &&
    badCursor.status === 409 &&
    badCursor.json?.code === "MALFORMED_CURSOR";
  return ok
    ? {
        note: "newest first; keyset pages 2+1 with no overlap; dealerId and limit 500 → 400; a bad cursor → 409 MALFORMED_CURSOR (platform convention)",
      }
    : {
        status: "FAIL",
        note: `desc ${desc} p1 ${p1.json?.data?.length} p2 ${p2.json?.data?.length} bad ${bad.status} limit ${badLimit.status} cursor ${badCursor.status}`,
      };
});
await h.check(r, "LEAD-007", async () => {
  const other = await EO.get("/v1/dealer/call-leads");
  const anonL = await h.call("GET", "/v1/dealer/call-leads", { base: API });
  const asCust = await c1.get("/v1/dealer/call-leads");
  r.ev(other, anonL, asCust);
  return other.status === 200 &&
    other.json.data.length === 0 &&
    anonL.status === 401 &&
    asCust.status === 401
    ? {
        note: "other dealership sees 0 of D’s leads; anonymous and customer sessions → 401",
      }
    : {
        status: "FAIL",
        note: `other ${other.status}/${other.json?.data?.length} anon ${anonL.status} cust ${asCust.status}`,
      };
});
await h.check(r, "LEAD-008", async () => {
  const all = await A.get("/v1/admin/call-leads?limit=100");
  const one = await A.get(`/v1/admin/call-leads?dealer=${D.slug}`);
  const none = await A.get(`/v1/admin/call-leads?dealer=${E.slug}`);
  const unknown = await A.get("/v1/admin/call-leads?dealer=no-such-dealer");
  const asDealer = await DO.get("/v1/admin/call-leads");
  r.ev(one, none, unknown, asDealer);
  const ok =
    all.status === 200 &&
    one.json.data.length === 3 &&
    one.json.data.every((x) => x.dealer.slug === D.slug) &&
    none.json.data.length === 0 &&
    [200, 404].includes(unknown.status) &&
    asDealer.status === 401;
  return ok
    ? {
        note: `admin sees leads with the dealership; ?dealer narrows (3 / 0); unknown slug → ${unknown.status}; dealer session → 401`,
      }
    : {
        status: "FAIL",
        note: `all ${all.status} one ${one.json?.data?.length} none ${none.json?.data?.length} unknown ${unknown.status} dealer ${asDealer.status}`,
      };
});
await h.check(r, "LEAD-009", async () => {
  await h.q(`UPDATE users SET "fullName"='Call Buyer Renamed' WHERE id=$1`, [
    c2.userId,
  ]);
  const o = await DO.get("/v1/dealer/call-leads");
  await h.q(`UPDATE users SET "fullName"='Call Buyer Two' WHERE id=$1`, [
    c2.userId,
  ]);
  return o.json.data.some((x) => x.customer.name === "Call Buyer Renamed")
    ? {
        note: "the lead shows the customer's current name, read at render time",
      }
    : {
        status: "FAIL",
        note: o.json.data.map((x) => x.customer.name).join(","),
      };
});

// ─── direct admin approval and withdrawal ──────────────────────────────────
await h.check(r, "APPR-007", async () => {
  await h.q(`UPDATE dealers SET landline=$2 WHERE id=$1`, [
    E.dealerId,
    E_NUMBER,
  ]);
  const before = await h.call("GET", `/v1/vehicles/${eCar.slug}`, {
    base: API,
  });
  const a1 = await A.post(
    `/v1/admin/dealers/${E.dealerId}/customer-contact/approve`,
  );
  const a2 = await A.post(
    `/v1/admin/dealers/${E.dealerId}/customer-contact/approve`,
  );
  const after = await h.call("GET", `/v1/vehicles/${eCar.slug}`, { base: API });
  const audits = await h.one(
    `SELECT count(*)::int n FROM audit_logs WHERE action='dealer.customer_contact.approved' AND "dealerId"=$1`,
    [E.dealerId],
  );
  const live = await h.one(`SELECT landline FROM dealers WHERE id=$1`, [
    E.dealerId,
  ]);
  r.ev(a1, a2, after);
  const ok =
    before.json.dealer.canCall === false &&
    a1.status === 200 &&
    a1.json.landline === "+919840012345" &&
    a2.status === 200 &&
    a2.json.approvedAt === a1.json.approvedAt &&
    audits.n === 1 &&
    live.landline === "+919840012345" &&
    after.json.dealer.canCall === true;
  return ok
    ? {
        note: "legacy onboarding number (SIM-LEGACY row) → Approve for calls normalises and approves; second call idempotent; one audit event",
      }
    : {
        status: "FAIL",
        note: `before ${before.json?.dealer?.canCall} a1 ${a1.status} ${a1.json?.landline} a2 ${a2.status} audits ${audits.n} after ${after.json?.dealer?.canCall}`,
      };
});
await h.check(r, "APPR-008", async () => {
  await h.q(
    `UPDATE dealers SET landline='call the office', "landlineApprovedAt"=NULL WHERE id=$1`,
    [N.dealerId],
  );
  const a = await A.post(
    `/v1/admin/dealers/${N.dealerId}/customer-contact/approve`,
  );
  const nf = await A.post(
    `/v1/admin/dealers/00000000-0000-4000-8000-000000000000/customer-contact/approve`,
  );
  const asDealer = await DO.post(
    `/v1/admin/dealers/${D.dealerId}/customer-contact/approve`,
  );
  const body = await A.post(
    `/v1/admin/dealers/${E.dealerId}/customer-contact/approve`,
    {
      x: 1,
    },
  );
  await h.q(`UPDATE dealers SET landline=NULL WHERE id=$1`, [N.dealerId]);
  r.ev(a, nf, asDealer, body);
  return a.status === 409 &&
    nf.status === 404 &&
    asDealer.status === 401 &&
    [200, 400].includes(body.status)
    ? {
        note: `unparseable legacy text → 409; unknown dealer → 404; dealer session → 401; body with a field → ${body.status}`,
      }
    : {
        status: "FAIL",
        note: `legacy ${a.status} nf ${nf.status} dealer ${asDealer.status} body ${body.status}`,
      };
});
await h.check(r, "APPR-009", async () => {
  const p = await DO.patch("/v1/dealer", {
    contact: { landline: "044 2345 0000" },
  });
  const ch = await h.one(
    `SELECT id FROM dealer_profile_changes WHERE "dealerId"=$1 AND status='PENDING'`,
    [D.dealerId],
  );
  const mid = await h.call("GET", `/v1/vehicles/${active.slug}`, { base: API });
  const x = await reveal(c2, active2.slug);
  const rj = await A.post(`/v1/admin/profile-changes/${ch.id}/reject`, {
    reason: "Please send the showroom number instead",
  });
  const live = await h.one(
    `SELECT landline, "landlineApprovedAt" FROM dealers WHERE id=$1`,
    [D.dealerId],
  );
  r.ev(p, mid, rj);
  return p.status === 200 &&
    mid.json.dealer.canCall === true &&
    x.json?.phone === D_E164 &&
    rj.status === 200 &&
    live.landline === D_E164 &&
    live.landlineApprovedAt
    ? {
        note: "replacement proposed while approved → old number stays live during review; rejection leaves it approved",
      }
    : {
        status: "FAIL",
        note: `patch ${p.status} mid ${mid.json?.dealer?.canCall} reveal ${x.status} reject ${rj.status} live ${JSON.stringify(live)}`,
      };
});
await h.check(r, "APPR-010", async () => {
  const p = await A.patch(`/v1/admin/dealers/${E.dealerId}`, {
    contact: { landline: "+91 98400 54321" },
  });
  const live = await h.one(
    `SELECT landline, "landlineApprovedAt" FROM dealers WHERE id=$1`,
    [E.dealerId],
  );
  const v = await h.call("GET", `/v1/vehicles/${eCar.slug}`, { base: API });
  const x = await reveal(c1, eCar.slug);
  r.ev(p, v, x);
  return p.status === 200 &&
    live.landlineApprovedAt === null &&
    v.json.dealer.canCall === false &&
    x.status === 404
    ? {
        note: "admin edits the number → approval withdrawn; canCall false; reveal → 404 until approved again",
      }
    : {
        status: "FAIL",
        note: `patch ${p.status} ${p.text.slice(0, 120)} live ${JSON.stringify(live)} canCall ${v.json?.dealer?.canCall} reveal ${x.status}`,
      };
});
await h.check(r, "CALL-010", async () => {
  await A.post(`/v1/admin/dealers/${E.dealerId}/customer-contact/approve`);
  const s = await A.post(`/v1/admin/dealers/${E.dealerId}/suspend`, {
    reason: "Certification suspension check",
  });
  const x = await reveal(c1, eCar.slug);
  const re = await A.post(`/v1/admin/dealers/${E.dealerId}/reinstate`, {
    note: "Certification reinstatement",
  });
  const y = await reveal(c1, eCar.slug);
  r.ev(s, x, re, y);
  return s.status === 200 && x.status === 409 && y.status === 200
    ? {
        note: `suspended dealership → reveal 409; reinstated (${re.status}) → 200`,
      }
    : {
        status: "FAIL",
        note: `suspend ${s.status} reveal ${x.status} reinstate ${re.status} again ${y.status}`,
      };
});
await h.check(r, "CALL-011", async () => {
  const e = await c1.post("/v1/enquiries", {
    listingSlug: nCar.slug,
    message: "Call me back",
  });
  r.ev(e);
  return e.status === 201
    ? {
        note: "a dealership without a number still takes callback enquiries (201)",
      }
    : { status: "FAIL", note: `status ${e.status}` };
});

// ─── privacy: the number is on no public surface ───────────────────────────
await h.check(r, "PRIV-001", async () => {
  const needles = [digitsOf(D_E164), "2345 6789", "23456789"];
  const surfaces = [
    await h.call("GET", `/v1/vehicles/${active.slug}`, { base: API }),
    await h.call("GET", `/v1/dealers/${D.slug}`, { base: API }),
    await h.call("GET", `/v1/vehicles?district=vellore`, { base: API }),
    await h.call("GET", `/v1/vehicles/${active.slug}/similar`, { base: API }),
    await h.call("GET", `/car/${active.slug}`, { base: WEB }),
    await h.call("GET", `/dealers/${D.slug}`, { base: WEB }),
  ];
  const leaks = surfaces
    .filter((s) => needles.some((n) => s.text.includes(n)))
    .map((s) => `${s.path}`);
  const statuses = surfaces.map((s) => s.status);
  return leaks.length === 0 && statuses.every((s) => s === 200)
    ? {
        note: `number absent from 4 API reads and the car + dealer HTML (${statuses.join("/")})`,
      }
    : {
        status: "FAIL",
        note: `leaks ${leaks.join(",")} statuses ${statuses.join("/")}`,
      };
});

// ─── rate limits (separate API with limits on) ─────────────────────────────
await h.check(r, "CALL-012", async () => {
  const c = await h.customer("Call Rate", h.phone(), API_RL);
  await h.call("POST", "/v1/legal/accept", {
    base: API_RL,
    cookie: c.cookie,
    body: { scope: "CUSTOMER", accepted: true },
  });
  const codes = [];
  let last = null;
  for (let i = 0; i < 11; i += 1) {
    last = await reveal(c, active.slug, {}, API_RL);
    codes.push(last.status);
  }
  r.ev(last);
  return codes.slice(0, 10).every((x) => x === 200) &&
    codes[10] === 429 &&
    last.json?.code === "CONTACT_RATE_LIMITED"
    ? {
        note: "10 reveals per customer per hour, the 11th → 429 CONTACT_RATE_LIMITED",
      }
    : { status: "FAIL", note: codes.join(",") };
});

r.save();
await h.pool.end();
