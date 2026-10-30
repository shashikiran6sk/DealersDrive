// BCALL-* — Enquire now, Call dealer, call leads and Approve for calls in Chromium, plus the
// #360 login regression. Web on CERT_WEB_LEGAL (LEGAL_V1_PREVIEW=true) against CERT_API_LEGAL.
import { randomUUID } from "node:crypto";

import * as b from "./bkit.mjs";
import * as h from "./lib.mjs";
import * as w from "./world.mjs";

const API = process.env.CERT_API_LEGAL ?? "http://localhost:4003";
const WEB = process.env.CERT_WEB_LEGAL ?? "http://localhost:3004";
const r = h.recorder("contact-browser");
const L = ["WEB", "BROWSER"];

async function legalCustomer(name) {
  const c = await h.customer(name, h.phone(), API);
  await h.call("POST", "/v1/legal/accept", {
    base: API,
    cookie: c.cookie,
    body: { scope: "CUSTOMER", accepted: true },
  });
  return c;
}
async function page(
  cookie,
  path,
  viewport = b.VIEWPORTS.desktop,
  mobile = false,
) {
  const ctx = await b.context({ cookie, viewport, mobile });
  const opened = await b.open(ctx, path, WEB);
  return { ctx, ...opened };
}
const visible = (p, text) =>
  p
    .getByText(text, { exact: false })
    .filter({ visible: true })
    .first()
    .isVisible()
    .catch(() => false);

const admin = await h.admin();
const D = await w.onboard("BCallMain");
await w.approveDealer(admin, D.dealerId);
const car = await w.published(D, admin);
const car2 = await w.published(D, admin);
await h.q(`UPDATE dealers SET landline='+914423450000' WHERE id=$1`, [
  D.dealerId,
]);
await h.call(
  "POST",
  `/v1/admin/dealers/${D.dealerId}/customer-contact/approve`,
  {
    base: API,
    cookie: admin.cookie,
  },
);
for (const owner of [D]) {
  await h.call("POST", "/v1/legal/accept", {
    base: API,
    cookie: owner.cookie,
    body: { scope: "DEALER", accepted: true },
  });
}
const N = await w.onboard("BCallNone");
await w.approveDealer(admin, N.dealerId);
const nCar = await w.published(N, admin);
const buyer = await legalCustomer("Browser Caller");
const fresh = await h.customer("Browser Unaccepted", h.phone(), API);

// ─── signed out ────────────────────────────────────────────────────────────
await h.check(
  r,
  "BCALL-001",
  async () => {
    const { ctx, page: p } = await page(null, `/car/${car.slug}`);
    const enquire = await visible(p, "Enquire now");
    const hint = await visible(p, "Requires login with your mobile number");
    const call = await visible(p, "Call dealer");
    const html = await p.content();
    await b.shot(p, "BCALL-001-signed-out");
    await p
      .getByRole("button", { name: "Enquire now" })
      .filter({ visible: true })
      .first()
      .click();
    await p.waitForURL(/\/login/, { timeout: 10000 });
    const url = new URL(p.url());
    await ctx.close();
    const back = url.searchParams.get("returnTo");
    return enquire &&
      hint &&
      !call &&
      !html.includes("4423450000") &&
      back === `/car/${car.slug}?enquire=1`
      ? {
          note: `only Enquire now + login hint; no Call dealer or number; click → /login?returnTo=${back}`,
        }
      : {
          status: "FAIL",
          note: `enquire ${enquire} hint ${hint} call ${call} returnTo ${back}`,
        };
  },
  { layers: L },
);

// ─── #360: a Google dealer session, then customer sign-in ──────────────────
await h.check(
  r,
  "BCALL-002",
  async () => {
    const id = randomUUID();
    await h.q(`INSERT INTO users (id, email) VALUES ($1, $2)`, [
      id,
      `google-only.${h.nonce()}@example.test`,
    ]);
    const cookie = await h.mintSession(id, "DEALER");
    const { ctx, page: p } = await page(
      cookie,
      `/login?returnTo=${encodeURIComponent(`/car/${car.slug}`)}`,
    );
    const phoneBox = await p
      .locator("input[name=phone]")
      .filter({ visible: true })
      .count();
    const terms = await visible(p, "I agree");
    const stayed = new URL(p.url()).pathname === "/login";
    await b.shot(p, "BCALL-002-google-dealer-then-customer-login");
    await ctx.close();
    return phoneBox > 0 && stayed && !terms
      ? {
          note: "email-only Google dealer session → /login shows the customer phone form, not the terms gate, and does not redirect home (SIM-GOOGLE)",
        }
      : {
          status: "FAIL",
          note: `phone inputs ${phoneBox} stayed ${stayed} terms ${terms} url ${p.url()}`,
        };
  },
  { layers: L },
);
await h.check(
  r,
  "BCALL-003",
  async () => {
    const a = await page(
      buyer.cookie,
      `/login?returnTo=${encodeURIComponent(`/car/${car.slug}`)}`,
    );
    const resumed = new URL(a.page.url()).pathname;
    await a.ctx.close();
    const loop = await page(
      buyer.cookie,
      `/login?returnTo=${encodeURIComponent("/login")}`,
    );
    const loopPath = new URL(loop.page.url()).pathname;
    const loopStatus = loop.status;
    await loop.ctx.close();
    const u = await page(fresh.cookie, "/login");
    const gate = await u.page
      .locator("form, [role=dialog], main")
      .first()
      .innerText();
    await b.shot(u.page, "BCALL-003-unaccepted-customer-terms");
    await u.ctx.close();
    return resumed === `/car/${car.slug}` &&
      loopPath === "/login" &&
      loopStatus === 200 &&
      /Terms/i.test(gate)
      ? {
          note: "accepted customer → /login resumes returnTo; returnTo=/login renders (no redirect loop); unaccepted customer sees the terms gate",
        }
      : {
          status: "FAIL",
          note: `resumed ${resumed} loop ${loopPath}/${loopStatus} gate ${gate.slice(0, 80)}`,
        };
  },
  { layers: L },
);

// ─── signed in: approved number → choices → call ───────────────────────────
for (const [id, viewport, mobile] of [
  ["BCALL-004", b.VIEWPORTS.desktop, false],
  ["BCALL-005", b.VIEWPORTS.mobile, true],
]) {
  await h.check(
    r,
    id,
    async () => {
      const { ctx, page: p } = await page(
        buyer.cookie,
        `/car/${car.slug}`,
        viewport,
        mobile,
      );
      const hint = await visible(p, "Requires login with your mobile number");
      await p
        .getByRole("button", { name: "Enquire now" })
        .filter({ visible: true })
        .first()
        .click();
      await p
        .getByText("How would you like to contact the dealer?")
        .waitFor({ timeout: 10000 });
      const consent = await visible(
        p,
        "The dealer will see your name and mobile number.",
      );
      const callback = await visible(p, "Request a callback");
      await b.shot(p, `${id}-choices`);
      await p.getByRole("button", { name: "Call dealer" }).click();
      const tel = p.locator('a[href="tel:+914423450000"]').first();
      await tel.waitFor({ timeout: 10000 });
      const shown = await tel.innerText();
      const overflow = await p.evaluate(
        () =>
          document.documentElement.scrollWidth -
          document.documentElement.clientWidth,
      );
      await b.shot(p, `${id}-number`);
      await ctx.close();
      return !hint &&
        consent &&
        callback &&
        shown.replace(/\D/g, "").endsWith("4423450000") &&
        overflow <= 0
        ? {
            note: `signed in → choices with consent line; Call dealer shows ${shown} as a tel: link; no overflow`,
          }
        : {
            status: "FAIL",
            note: `hint ${hint} consent ${consent} callback ${callback} shown ${shown} overflow ${overflow}`,
          };
    },
    { layers: L },
  );
}
await h.check(
  r,
  "BCALL-006",
  async () => {
    const { ctx, page: p } = await page(buyer.cookie, `/car/${car2.slug}`);
    await p
      .getByRole("button", { name: "Enquire now" })
      .filter({ visible: true })
      .first()
      .click();
    await p.getByRole("button", { name: "Request a callback" }).click();
    await p.locator('textarea[name="message"]').fill("Please call after 6pm");
    await p.getByRole("button", { name: "Send enquiry" }).click();
    await p.getByText("Enquiry sent").waitFor({ timeout: 10000 });
    await b.shot(p, "BCALL-006-callback-sent");
    await ctx.close();
    const row = await h.one(
      `SELECT count(*)::int n FROM enquiries e JOIN listings l ON l.id=e."listingId" WHERE l.slug=$1 AND e."customerId"=$2`,
      [car2.slug, buyer.userId],
    );
    return row.n === 1
      ? {
          note: "Request a callback → enquiry form → Enquiry sent; one enquiry row",
        }
      : { status: "FAIL", note: `rows ${row.n}` };
  },
  { layers: L },
);
await h.check(
  r,
  "BCALL-007",
  async () => {
    const { ctx, page: p } = await page(buyer.cookie, `/car/${nCar.slug}`);
    await p
      .getByRole("button", { name: "Enquire now" })
      .filter({ visible: true })
      .first()
      .click();
    await p.locator('textarea[name="message"]').waitFor({ timeout: 10000 });
    const call = await visible(p, "Call dealer");
    await b.shot(p, "BCALL-007-no-number-form");
    await ctx.close();
    return !call
      ? {
          note: "dealer without an approved number → Enquire now opens the enquiry form directly",
        }
      : {
          status: "FAIL",
          note: "Call dealer offered without an approved number",
        };
  },
  { layers: L },
);
await h.check(
  r,
  "BCALL-008",
  async () => {
    const { ctx, page: p } = await page(
      buyer.cookie,
      `/car/${car.slug}?enquire=1`,
    );
    await p
      .getByText("How would you like to contact the dealer?")
      .waitFor({ timeout: 10000 });
    await ctx.close();
    return {
      note: "return from login (?enquire=1) reopens straight at the contact choices",
    };
  },
  { layers: L },
);

// ─── dealer and admin consoles ─────────────────────────────────────────────
await h.check(
  r,
  "BCALL-009",
  async () => {
    const inbox = await page(D.cookie, "/dealer/enquiries");
    const link = await inbox.page
      .getByRole("link", { name: "Customer calls" })
      .count();
    await inbox.ctx.close();
    const { ctx, page: p } = await page(D.cookie, "/dealer/enquiries/calls");
    const named = await visible(p, "Browser Caller");
    const tel = await p.locator('a[href^="tel:+91"]').count();
    await b.shot(p, "BCALL-009-dealer-calls");
    await ctx.close();
    return link > 0 && named && tel > 0
      ? {
          note: "inbox links to Customer calls; the lead shows the caller’s name and a call-back link",
        }
      : { status: "FAIL", note: `link ${link} named ${named} tel ${tel}` };
  },
  { layers: L },
);
await h.check(
  r,
  "BCALL-010",
  async () => {
    const { ctx, page: p } = await page(admin.cookie, "/admin/enquiries/calls");
    const named = await visible(p, "Browser Caller");
    const dealer = await visible(p, "BCallMain Motors");
    await b.shot(p, "BCALL-010-admin-calls");
    await ctx.close();
    return named && dealer
      ? { note: "admin Customer calls lists the lead with its dealership" }
      : { status: "FAIL", note: `named ${named} dealer ${dealer}` };
  },
  { layers: L },
);
await h.check(
  r,
  "BCALL-011",
  async () => {
    await h.q(`UPDATE dealers SET landline='+914423459999' WHERE id=$1`, [
      N.dealerId,
    ]);
    const { ctx, page: p } = await page(
      admin.cookie,
      `/admin/dealers/${N.dealerId}`,
    );
    const before = await visible(p, "Not approved for calls");
    await p.getByRole("button", { name: "Approve for calls" }).click();
    await p
      .getByText("Approved for calls on", { exact: false })
      .waitFor({ timeout: 10000 });
    await b.shot(p, "BCALL-011-admin-approve");
    await ctx.close();
    const row = await h.one(
      `SELECT "landlineApprovedAt" FROM dealers WHERE id=$1`,
      [N.dealerId],
    );
    const v = await h.call("GET", `/v1/vehicles/${nCar.slug}`, { base: API });
    return before && row.landlineApprovedAt && v.json.dealer.canCall === true
      ? {
          note: "admin dealer page: Not approved → Approve for calls → Approved on …; canCall true",
        }
      : {
          status: "FAIL",
          note: `before ${before} approved ${row.landlineApprovedAt} canCall ${v.json?.dealer?.canCall}`,
        };
  },
  { layers: L },
);
await h.check(
  r,
  "BCALL-012",
  async () => {
    const { ctx, page: p } = await page(buyer.cookie, `/car/${nCar.slug}`);
    await p
      .getByRole("button", { name: "Enquire now" })
      .filter({ visible: true })
      .first()
      .click();
    const choices = await p
      .getByText("How would you like to contact the dealer?")
      .waitFor({ timeout: 10000 })
      .then(() => true)
      .catch(() => false);
    await ctx.close();
    return choices
      ? {
          note: "after Approve for calls the car page offers the choices on the next load (no stale canCall)",
        }
      : {
          status: "FAIL",
          note: "car page still served the pre-approval panel (stale canCall)",
        };
  },
  { layers: L },
);

await b.close();
r.save();
await h.pool.end();
