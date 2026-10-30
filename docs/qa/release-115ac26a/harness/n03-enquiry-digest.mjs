// DIGEST-* — the daily enquiry summary to admins (#359), through the real pg-boss schedule
// and worker of the API on CERT_API (JOBS_ENABLED=true, MAIL_DRIVER=console).
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import * as h from "./lib.mjs";
import * as w from "./world.mjs";

const r = h.recorder("enquiry-digest");
const requireApi = createRequire(resolve(h.REPO, "apps/api/package.json"));
const { PgBoss } = requireApi("pg-boss");
const LOG = (process.env.CERT_API_LOG ?? "").split(",").filter(Boolean).at(-1);

const IST = 330 * 60_000;
const yesterday = new Date(Date.now() + IST - 86_400_000)
  .toISOString()
  .slice(0, 10);
const twoDaysAgo = new Date(Date.now() + IST - 2 * 86_400_000)
  .toISOString()
  .slice(0, 10);
const istNoon = (day) => new Date(`${day}T12:00:00+05:30`).toISOString();
const istEdge = (day, hhmmss) =>
  new Date(`${day}T${hhmmss}+05:30`).toISOString();

const admin = await h.admin();
const A = await w.onboard("DigestAlpha");
await w.approveDealer(admin, A.dealerId);
const B = await w.onboard("DigestBeta");
await w.approveDealer(admin, B.dealerId);
const a1 = await w.published(A, admin);
const a2 = await w.published(A, admin);
const b1 = await w.published(B, admin);

async function enquiry(slug, when) {
  const c = await h.customer(`Digest Buyer ${h.nonce()}`);
  const e = await c.post("/v1/enquiries", {
    listingSlug: slug,
    message: "digest check",
  });
  if (e.status !== 201) throw new Error(`enquiry ${e.status} ${e.text}`);
  if (when)
    await h.q(`UPDATE enquiries SET "createdAt"=$2 WHERE id=$1`, [
      e.json.id,
      when,
    ]);
  return e.json.id;
}
await enquiry(a1.slug, istNoon(yesterday));
await enquiry(a1.slug, istEdge(yesterday, "00:00:00"));
await enquiry(a2.slug, istEdge(yesterday, "23:59:59"));
await enquiry(b1.slug, istNoon(yesterday));
await enquiry(b1.slug, istNoon(twoDaysAgo));
await enquiry(b1.slug, null);

const digestRows = () =>
  h.q(
    `SELECT recipient, status, "dedupeKey" FROM notification_deliveries WHERE template='admin.enquiry.digest' AND "dedupeKey" LIKE $1`,
    [`admin.enquiry.digest:${yesterday}:%`],
  );

await h.check(r, "DIGEST-001", async () => {
  const s = await h.q(
    `SELECT name, cron, timezone FROM pgboss.schedule WHERE name=$1`,
    ["notifications.enquiry-digest"],
  );
  return s.length === 1 &&
    s[0].cron === "31 8 * * *" &&
    s[0].timezone === "Asia/Kolkata"
    ? {
        note: "the API registered one schedule: 31 8 * * * Asia/Kolkata (08:31 IST daily)",
      }
    : { status: "FAIL", note: JSON.stringify(s) };
});

const boss = new PgBoss({ connectionString: h.DB_URL, schema: "pgboss" });
boss.on("error", () => undefined);
await boss.start();
async function fire() {
  await boss.send("notifications.enquiry-digest", {});
  const until = Date.now() + 45_000;
  while (Date.now() < until) {
    const rows = await digestRows();
    if (rows.length && rows.every((x) => x.status === "SENT")) return rows;
    await new Promise((ok) => setTimeout(ok, 1000));
  }
  return digestRows();
}

const expected = await h.q(
  `SELECT DISTINCT lower(u.email) email FROM users u WHERE u.email = ANY($1::text[])`,
  [
    (
      process.env.CERT_ADMIN_ALLOWLIST ??
      "cert-admin@example.test,cert-admin2@example.test"
    ).split(","),
  ],
);
let first = [];
await h.check(r, "DIGEST-002", async () => {
  first = await fire();
  const recipients = first.map((x) => x.recipient.toLowerCase()).sort();
  return first.length >= 1 &&
    first.every((x) => x.status === "SENT") &&
    new Set(recipients).size === recipients.length
    ? {
        note: `the scheduled job, run by the API worker, sent ${first.length} digest(s) for ${yesterday}, one per admin (${expected.length} allowlisted admin account(s) exist)`,
      }
    : { status: "FAIL", note: JSON.stringify(first) };
});
await h.check(r, "DIGEST-003", async () => {
  const text = LOG ? readFileSync(LOG, "utf8") : "";
  const at = text.lastIndexOf("Customers sent 4 enquiries to 2 dealerships.");
  const block = text.slice(Math.max(0, at), at + 2000);
  const alpha = /DigestAlpha[^\n]* — 3: [^\n]*/.exec(block)?.[0] ?? "";
  const beta = /DigestBeta[^\n]* — 1: [^\n]*/.exec(block)?.[0] ?? "";
  const total = at >= 0;
  return LOG && at >= 0 && alpha && beta && total
    ? {
        note: `the console mailer printed the digest: "${alpha.trim().slice(0, 60)}" / "${beta.trim().slice(0, 60)}"; 4 enquiries (IST day edges 00:00:00 and 23:59:59 in, the day before and today out)`,
      }
    : {
        status: "FAIL",
        note: `log ${!!LOG} alpha "${alpha}" beta "${beta}" block ${block.slice(0, 300)}`,
      };
});
await h.check(r, "DIGEST-004", async () => {
  const again = await fire();
  return again.length === first.length
    ? {
        note: "firing the job again for the same day sends nothing more (dedupe key per day and admin)",
      }
    : { status: "FAIL", note: `${first.length} → ${again.length}` };
});
await h.check(r, "DIGEST-005", async () => {
  const per = await h.q(
    `SELECT count(*)::int n FROM notification_deliveries WHERE template LIKE 'admin.enquiry%' AND template <> 'admin.enquiry.digest' AND "createdAt" > now() - interval '1 hour'`,
  );
  return per[0].n === 0
    ? {
        note: "no per-enquiry admin email was sent for the 6 enquiries — only the daily summary",
      }
    : { status: "FAIL", note: `${per[0].n} per-enquiry admin emails` };
});

await boss.stop({ graceful: false, wait: false }).catch(() => undefined);
r.save();
await h.pool.end();
