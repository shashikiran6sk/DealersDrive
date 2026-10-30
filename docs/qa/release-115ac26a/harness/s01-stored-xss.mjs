// Stored XSS: script-shaped text saved through the API into every free-text field a different
// audience later sees, then rendered by Chromium on the production web build. A payload that
// executes sets window.__dd_xss or opens a dialog; either is a FAIL.
import * as b from "./bkit.mjs";
import * as h from "./lib.mjs";
import * as w from "./world.mjs";

const r = h.recorder("stored-xss");
const admin = await h.admin();
const PAYLOADS = [
  '<img src=x onerror="window.__dd_xss=1">',
  "<script>window.__dd_xss=1</script>",
  '"><svg onload="window.__dd_xss=1">',
  "javascript:window.__dd_xss=1",
];
const text = (prefix) => `${prefix} ${PAYLOADS.join(" ")}`;

// The tagline is written directly: through the API an ACTIVE dealer's tagline change waits
// for moderation. Description, enquiry and ticket go through the API.
const D = await w.onboard(`Xss${h.nonce().slice(0, 4)}`);
await h.q(`UPDATE dealers SET tagline=$2 WHERE id=$1`, [
  D.dealerId,
  text("Tagline"),
]);
await w.approveDealer(admin, D.dealerId);
const car = await w.published(D, admin, {
  ...w.COMPLETE_VEHICLE,
  description: text("Description"),
});
const buyer = await h.customer("Xss Buyer");
const enquiry = await buyer.post("/v1/enquiries", {
  listingSlug: car.slug,
  message: text("Enquiry").slice(0, 900),
});
const ticket = await buyer.post("/v1/support/tickets", {
  category: "GENERAL_QUESTION",
  subject: 'Subject <img src=x onerror="window.__dd_xss=1">',
  description: text("Ticket description"),
});
const saved = {
  tagline:
    (
      await h.one(`SELECT tagline FROM dealers WHERE id=$1`, [D.dealerId])
    ).tagline?.includes("onerror") ?? false,
  description:
    (
      await h.one(`SELECT description FROM vehicles WHERE id=$1`, [
        car.vehicleId,
      ])
    ).description?.includes("onerror") ?? false,
  enquiry: enquiry.status,
  ticket: ticket.status,
};

async function visit(cookie, path) {
  const ctx = await b.context({ cookie });
  const page = await ctx.newPage();
  let dialog = false;
  page.on("dialog", async (d) => {
    dialog = true;
    await d.dismiss();
  });
  const res = await page.goto(`${b.WEB}${path}`, { waitUntil: "networkidle" });
  await b.sleep(500);
  const fired = await page.evaluate(() => window.__dd_xss === 1);
  const shownAsText = await page.evaluate(() =>
    document.body.innerText.includes("onerror"),
  );
  await ctx.close();
  return {
    path: path.replace(/[0-9a-f-]{36}/g, ":id"),
    status: res?.status() ?? 0,
    fired,
    dialog,
    shownAsText,
  };
}

await h.check(r, "SEC-DISC-003", async () => {
  const pages = [
    await visit(undefined, `/car/${car.slug}`),
    await visit(undefined, `/dealers/${D.slug}`),
    await visit(undefined, "/dealers"),
    await visit(D.cookie, "/dealer/enquiries"),
    await visit(buyer.cookie, "/enquiries"),
    await visit(buyer.cookie, `/support-requests/${ticket.json?.id}`),
    await visit(admin.cookie, `/admin/enquiries/${enquiry.json?.id}`),
    await visit(admin.cookie, `/admin/support/${ticket.json?.id}`),
    await visit(admin.cookie, `/admin/dealers/${D.dealerId}`),
  ];
  r.ev({ saved, pages });
  const executed = pages.filter((p) => p.fired || p.dialog);
  const rendered = pages.filter((p) => p.shownAsText).length;
  if (
    !saved.description ||
    saved.enquiry !== 201 ||
    (saved.ticket !== 201 && saved.ticket !== 200)
  )
    return {
      status: "FAIL",
      note: `payloads not stored as expected: ${JSON.stringify(saved)}`,
    };
  return executed.length === 0 && rendered >= 5
    ? {
        layers: ["BROWSER", "SECURITY"],
        note: `4 payloads stored in tagline, description, enquiry and ticket; rendered as inert text on ${rendered} of ${pages.length} public, dealer, customer and admin pages; none executed`,
      }
    : {
        status: "FAIL",
        layers: ["BROWSER", "SECURITY"],
        note: `executed on ${executed.map((p) => p.path).join(", ") || "none"}; shown as text on ${rendered}`,
      };
});

r.save();
await b.close();
await h.pool.end();
