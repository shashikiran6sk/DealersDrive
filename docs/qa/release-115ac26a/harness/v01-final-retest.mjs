// Final retest on the release candidate: every baseline defect (BUG-101…113) and decision
// (UPD-2, UPD-3) re-verified live, replacing the hand-written baseline analysis verdicts.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import * as b from "./bkit.mjs";
import * as h from "./lib.mjs";
import * as w from "./world.mjs";

const r = h.recorder("zz-zfinal-retest");
const admin = await h.admin();
const D = await w.onboard("FinalRetest");
await w.approveDealer(admin, D.dealerId);
const car = await w.published(D, admin);

async function enquiry() {
  const c = await h.customer(`Retest Buyer ${h.nonce()}`);
  const e = await c.post("/v1/enquiries", {
    listingSlug: car.slug,
    message: "retest",
  });
  if (e.status !== 201) throw new Error(`enquiry ${e.status} ${e.text}`);
  return e.json.id;
}
const move = (id, status) => D.patch(`/v1/dealer/enquiries/${id}`, { status });

await h.check(r, "ENQ-LIFE-007", async () => {
  const one = await enquiry();
  const a = await move(one, "CONTACTED");
  const b2 = await move(one, "CLOSED");
  const two = await enquiry();
  const c = await move(two, "SPAM");
  r.ev(a, b2, c);
  return a.status === 200 && b2.status === 200 && c.status === 200
    ? {
        note: "OWNER: NEW→CONTACTED→CLOSED and NEW→SPAM all 200 (UPD-2 forward-only paths)",
      }
    : { status: "FAIL", note: `${a.status} ${b2.status} ${c.status}` };
});
await h.check(r, "ENQ-LIFE-010", async () => {
  const closed = await enquiry();
  await move(closed, "CLOSED");
  const spam = await enquiry();
  await move(spam, "SPAM");
  const contacted = await enquiry();
  await move(contacted, "CONTACTED");
  const attempts = {
    "CLOSED→CONTACTED": await move(closed, "CONTACTED"),
    "CLOSED→SPAM": await move(closed, "SPAM"),
    "CLOSED→NEW": await move(closed, "NEW"),
    "SPAM→CLOSED": await move(spam, "CLOSED"),
    "SPAM→CONTACTED": await move(spam, "CONTACTED"),
    "CONTACTED→NEW": await move(contacted, "NEW"),
  };
  const codes = Object.fromEntries(
    Object.entries(attempts).map(([k, v]) => [k, v.status]),
  );
  const rows = await h.q(
    `SELECT id, status FROM enquiries WHERE id = ANY($1::uuid[])`,
    [[closed, spam, contacted]],
  );
  const kept = Object.fromEntries(rows.map((x) => [x.id, x.status]));
  r.ev({ codes, kept });
  const refused = Object.values(codes).every((s) => s === 409 || s === 400);
  return refused &&
    kept[closed] === "CLOSED" &&
    kept[spam] === "SPAM" &&
    kept[contacted] === "CONTACTED"
    ? {
        note: `UPD-2: every backward or out-of-final move refused (${JSON.stringify(codes)}); statuses unchanged`,
      }
    : {
        status: "FAIL",
        note: `${JSON.stringify(codes)} ${JSON.stringify(kept)}`,
      };
});

await h.check(r, "DEP-DISC-001", async () => {
  let out = "";
  try {
    out = execFileSync("pnpm", ["audit", "--json"], {
      cwd: h.REPO,
      encoding: "utf8",
    });
  } catch (error) {
    out = error.stdout ?? "";
  }
  const v = JSON.parse(out).metadata.vulnerabilities;
  r.ev(v);
  return v.critical === 0 && v.high === 0
    ? {
        note: `BUG-108 fixed: pnpm audit ${JSON.stringify(v)} — no high or critical`,
      }
    : { status: "FAIL", note: JSON.stringify(v) };
});
await h.check(r, "PERF-DISC-001", async () => {
  const src = readFileSync(
    resolve(h.REPO, "apps/api/src/platform/jobs/queue.ts"),
    "utf8",
  );
  const m =
    /'notification\.email':\s*\{\s*pollingIntervalSeconds:\s*([\d.]+)/.exec(
      src,
    );
  return m && Number(m[1]) <= 0.5
    ? {
        layers: ["CODE"],
        note: `BUG-104 fixed: notification.email polls every ${m[1]} s (was 2 s, 30 jobs/min); see EVIDENCE/email-queue`,
      }
    : { status: "FAIL", note: "polling interval not lowered" };
});
await h.check(r, "DATA-DISC-003", async () => {
  const rows = await h.q(
    `SELECT d."brandName", (SELECT count(*)::int FROM dealer_members m WHERE m."dealerId"=d.id AND m.role='OWNER') owners
       FROM dealers d WHERE d."onboardingSource"::text <> 'SELF'`,
  );
  return rows.length > 0 && rows.every((x) => x.owners === 1)
    ? {
        layers: ["DATABASE"],
        note: `BUG-103 fixed: ${rows.length} assisted dealerships, each with one OWNER`,
      }
    : { status: "FAIL", note: JSON.stringify(rows) };
});
await h.check(r, "DOC-DISC-002", async () => {
  const agents = readFileSync(resolve(h.REPO, "AGENTS.md"), "utf8");
  return /Public visibility is two rules[\s\S]{0,1500}`SOLD`\s+or\s+`WITHDRAWN`\s+car\s+is\s+on\s+no\s+public\s+surface/.test(
    agents,
  )
    ? {
        layers: ["DOCS"],
        note: "BUG-106 fixed: AGENTS.md invariant 6 states R71 (sold/withdrawn on no public surface)",
      }
    : { status: "FAIL", note: "invariant 6 text not found" };
});
await h.check(r, "UAT-OBS-001", async () => {
  const ctx = await b.context();
  const { page } = await b.open(ctx, "/saved");
  const text = await page.locator("main").innerText();
  await b.shot(page, "UAT-OBS-001-saved-signed-out");
  await ctx.close();
  return !/No saved cars yet/i.test(text) && /sign in|log in|login/i.test(text)
    ? {
        layers: ["WEB", "BROWSER"],
        note: `BUG-105/UPD-3 fixed: signed-out /saved asks the visitor to sign in ("${(text.match(/[^\n]*(sign in|log in|login)[^\n]*/i) ?? [""])[0].trim().slice(0, 90)}")`,
      }
    : { status: "FAIL", note: text.slice(0, 160) };
});
await h.check(r, "UAT-OBS-002", async () => {
  const res = await h.call("GET", "/car/no-such-car-xyz", { base: b.WEB });
  const title = /<title>([^<]*)/.exec(res.text)?.[1];
  const formatted =
    res.text.includes("+91 41622 48890") || /\+91 \d{5} \d{5}/.test(res.text);
  return res.status === 404 && /Page not found/.test(title) && formatted
    ? {
        layers: ["WEB"],
        note: `BUG-101/107 fixed: 404, title "${title}", footer number formatted`,
      }
    : { status: "FAIL", note: `${res.status} ${title} formatted ${formatted}` };
});
await h.check(r, "UAT-OBS-003", async () => {
  const ctx = await b.context({ cookie: D.cookie });
  const { page } = await b.open(ctx, "/dealer");
  const text = await page.locator("body").innerText();
  await b.shot(page, "UAT-OBS-003-dealer-console-no-credits");
  await ctx.close();
  return !/credits/i.test(text)
    ? {
        layers: ["WEB", "BROWSER"],
        note: "BUG-110 fixed: the dealer console shows no credit balance or credits panel",
      }
    : { status: "FAIL", note: "credits still shown" };
});
await h.check(r, "ORIG-DISC-PROFILE-001 second profile edit", async () => {
  const doc = (await h.call("GET", "/api/docs/openapi.json")).json;
  const desc = doc.paths["/v1/dealer"].patch.description;
  const second = await D.patch("/v1/dealer", {
    tagline: "First pending tagline for retest",
  });
  const third = await D.patch("/v1/dealer", {
    tagline: "Second tagline while one is pending",
  });
  r.ev(second, third);
  return third.status === 409 &&
    third.json?.code === "PROFILE_EDIT_PENDING" &&
    /one pending request per dealership/.test(desc) &&
    doc.paths["/v1/dealer"].patch.responses["409"]
    ? {
        note: 'second edit while pending → 409 PROFILE_EDIT_PENDING; the reference documents "one pending request per dealership; cancel it before proposing another change" and a 409 — not a bug (as in the baseline triage)',
      }
    : { status: "FAIL", note: `${third.status} ${third.json?.code}` };
});

await h.check(r, "RETEST-BUG-112", async () => {
  const key = "support.customerPhone";
  const before = await h.call("GET", "/v1/config/public");
  const set = await admin.put(`/v1/admin/config/${key}`, {
    value: "+919444012345",
  });
  const after = await h.call("GET", "/v1/config/public");
  const restore = await admin.put(`/v1/admin/config/${key}`, {
    value: before.json.supportPhone,
  });
  r.ev(set, {
    before: before.json.supportPhone,
    after: after.json.supportPhone,
    restore: restore.status,
  });
  return set.status === 200 &&
    after.json.supportPhone === "+919444012345" &&
    after.json.support?.customer?.phone === "+919444012345" &&
    restore.status === 200
    ? {
        note: "admin config change → the top-level supportPhone the footer reads and support.customer agree at once (one value, one public-config tag); restored",
      }
    : {
        status: "FAIL",
        note: `set ${set.status} ${set.text.slice(0, 120)} top ${after.json?.supportPhone} support ${after.json?.support?.customer?.phone}`,
      };
});
await h.check(r, "RETEST-BUG-113", async () => {
  const sold = await w.published(D, admin);
  const district = (
    await h.one(`SELECT district FROM dealers WHERE id=$1`, [D.dealerId])
  ).district.toLowerCase();
  const before = await h.call("GET", `/cars?district=${district}`, {
    base: b.WEB,
  });
  const mark = await D.post(`/v1/dealer/vehicles/${sold.vehicleId}/mark-sold`);
  const after = await h.call("GET", `/cars?district=${district}`, {
    base: b.WEB,
  });
  const listedBefore = before.text.includes(sold.slug);
  const listedAfter = after.text.includes(sold.slug);
  r.ev({ district, listedBefore, mark: mark.status, listedAfter });
  return listedBefore && mark.status === 200 && !listedAfter
    ? {
        layers: ["WEB"],
        note: `a car on /cars?district=${district} disappears on the very next request after Mark sold (no cached results)`,
      }
    : {
        status: "FAIL",
        note: `before ${listedBefore} mark ${mark.status} after ${listedAfter}`,
      };
});

await b.close();
r.save();
await h.pool.end();
