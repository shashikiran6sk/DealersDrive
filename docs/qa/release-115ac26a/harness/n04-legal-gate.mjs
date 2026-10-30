// LEGAL-* — the legal v1 gate as production runs it (LEGAL_V1_PREVIEW=true on CERT_API_LEGAL):
// customer surfaces, dealer console, and the web redirect for an unaccepted customer.
import * as h from "./lib.mjs";
import * as w from "./world.mjs";

const API = process.env.CERT_API_LEGAL ?? "http://localhost:4003";
const WEB = process.env.CERT_WEB_LEGAL ?? "http://localhost:3004";
const r = h.recorder("legal-gate");
const as = (a) => ({
  get: (p) => h.call("GET", p, { base: API, cookie: a?.cookie }),
  post: (p, body) => h.call("POST", p, { base: API, body, cookie: a?.cookie }),
});

const admin = await h.admin();
const D = await w.onboard("LegalDealer");
await w.approveDealer(admin, D.dealerId);
const car = await w.published(D, admin);
const c = await h.customer("Legal Buyer", h.phone(), API);
const C = as(c);
const DD = as(D);

await h.check(r, "LEGAL-001", async () => {
  const s = await C.get("/v1/legal/status?scope=CUSTOMER");
  const anon = await h.call("GET", "/v1/legal/status?scope=CUSTOMER", {
    base: API,
  });
  r.ev(s, anon);
  return s.status === 200 &&
    s.json.enabled &&
    !s.json.accepted &&
    s.json.canAccept
    ? {
        note: `new customer: enabled, not accepted, can accept; anonymous status → ${anon.status}`,
      }
    : { status: "FAIL", note: `status ${s.status} ${s.text.slice(0, 160)}` };
});
await h.check(r, "LEGAL-002", async () => {
  const e = await C.post("/v1/enquiries", {
    listingSlug: car.slug,
    message: "before terms",
  });
  const s = await C.post("/v1/saved-vehicles", { listingSlug: car.slug });
  const l = await C.get("/v1/enquiries");
  r.ev(e, s, l);
  const rows = await h.q(`SELECT 1 FROM enquiries WHERE "customerId"=$1`, [
    c.userId,
  ]);
  return e.status === 403 &&
    s.status === 403 &&
    l.status === 403 &&
    rows.length === 0
    ? {
        note: "unaccepted customer: enquiry, save and enquiry list → 403; nothing written",
      }
    : {
        status: "FAIL",
        note: `enquiry ${e.status} save ${s.status} list ${l.status} rows ${rows.length}`,
      };
});
await h.check(r, "LEGAL-003", async () => {
  const extra = await C.post("/v1/legal/accept", {
    scope: "CUSTOMER",
    accepted: true,
    x: 1,
  });
  const falsy = await C.post("/v1/legal/accept", {
    scope: "CUSTOMER",
    accepted: false,
  });
  const scope = await C.post("/v1/legal/accept", {
    scope: "ADMIN",
    accepted: true,
  });
  const anon = await h.call("POST", "/v1/legal/accept", {
    base: API,
    body: { scope: "CUSTOMER", accepted: true },
  });
  r.ev(extra, falsy, scope, anon);
  return [extra, falsy, scope].every((x) => x.status === 400) &&
    anon.status === 401
    ? {
        note: "unknown field, accepted:false and a bad scope → 400; anonymous accept → 401",
      }
    : {
        status: "FAIL",
        note: `extra ${extra.status} false ${falsy.status} scope ${scope.status} anon ${anon.status}`,
      };
});
await h.check(r, "LEGAL-004", async () => {
  const a = await C.post("/v1/legal/accept", {
    scope: "CUSTOMER",
    accepted: true,
  });
  const again = await C.post("/v1/legal/accept", {
    scope: "CUSTOMER",
    accepted: true,
  });
  const s = await C.get("/v1/legal/status?scope=CUSTOMER");
  const e = await C.post("/v1/enquiries", {
    listingSlug: car.slug,
    message: "after terms",
  });
  const rows = await h
    .q(
      `SELECT count(*)::int n FROM legal_acceptances WHERE "userId"=$1 AND "dealerId" IS NULL`,
      [c.userId],
    )
    .catch((error) => [{ n: `?(${error.message.slice(0, 40)})` }]);
  r.ev(a, again, s, e);
  return [200, 201].includes(a.status) &&
    [200, 201].includes(again.status) &&
    s.json.accepted &&
    e.status === 201 &&
    rows[0].n === 1
    ? {
        note: `accept → ${a.status}; repeat → ${again.status}; status accepted; enquiry → 201 (acceptance rows ${rows[0].n})`,
      }
    : {
        status: "FAIL",
        note: `accept ${a.status} again ${again.status} enquiry ${e.status}`,
      };
});
await h.check(r, "LEGAL-005", async () => {
  const before = await DD.get("/v1/dealer/vehicles");
  const st = await DD.get("/v1/legal/status?scope=DEALER");
  const a = await DD.post("/v1/legal/accept", {
    scope: "DEALER",
    accepted: true,
  });
  const after = await DD.get("/v1/dealer/vehicles");
  r.ev(before, st, a, after);
  return before.status === 403 &&
    [200, 201].includes(a.status) &&
    after.status === 200
    ? {
        note: "active dealer without dealer terms: console API → 403; after accepting → 200",
      }
    : {
        status: "FAIL",
        note: `before ${before.status} accept ${a.status} after ${after.status}`,
      };
});
await h.check(r, "LEGAL-006", async () => {
  const draft = await w.onboard("LegalDraft", { submit: false });
  const X = as(draft);
  const profile = await X.get("/v1/dealer");
  const completeness = await X.get("/v1/dealer/completeness");
  const vehicles = await X.get("/v1/dealer/vehicles");
  r.ev(profile, completeness, vehicles);
  return profile.status === 200 &&
    completeness.status === 200 &&
    vehicles.status === 403
    ? {
        note: "a DRAFT dealer can finish onboarding paths without terms; other console routes → 403",
      }
    : {
        status: "FAIL",
        note: `profile ${profile.status} completeness ${completeness.status} vehicles ${vehicles.status}`,
      };
});
await h.check(
  r,
  "LEGAL-007",
  async () => {
    const fresh = await h.customer("Legal Web Buyer", h.phone(), API);
    const res = await h.call("GET", "/enquiries", {
      base: WEB,
      cookie: fresh.cookie,
    });
    const streamed = /NEXT_REDIRECT;replace;(\/login\?returnTo=[^;]+);307/.exec(
      res.text,
    )?.[1];
    const loc = res.headers.location ?? streamed ?? "";
    const page = await h.call("GET", "/login", {
      base: WEB,
      cookie: fresh.cookie,
    });
    return ([303, 307, 308].includes(res.status) ||
      (res.status === 200 && streamed)) &&
      loc.startsWith("/login?returnTo=") &&
      /Terms/i.test(page.text)
      ? {
          note: `unaccepted customer opening /enquiries → ${streamed ? "streamed redirect (200 + NEXT_REDIRECT/meta refresh)" : res.status} to ${loc}; /login renders the terms gate`,
        }
      : { status: "FAIL", note: `status ${res.status} location ${loc}` };
  },
  { layers: ["WEB"] },
);

r.save();
await h.pool.end();
