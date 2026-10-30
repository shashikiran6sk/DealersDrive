// Two Agent-UAT checks the mouse cannot make: a real touch swipe on the vehicle gallery
// (CDP touch events on an emulated phone) and Back/Forward across client-side navigations.
import * as b from "./bkit.mjs";
import * as h from "./lib.mjs";

const r = h.recorder("agent-uat-touch");
const car = await h.one(
  `SELECT l.slug FROM listings l JOIN dealers d ON d.id=l."dealerId" JOIN vehicle_media vm ON vm."vehicleId"=l."vehicleId" WHERE l.status='ACTIVE' AND d.status='ACTIVE' AND l.slug IS NOT NULL GROUP BY l.slug, l."createdAt" HAVING count(*) >= 3 ORDER BY l."createdAt" DESC LIMIT 1`,
);

await h.check(r, "UAT-DISC-001", async () => {
  const ctx = await b.context({ viewport: b.VIEWPORTS.mobile, mobile: true });
  const page = await ctx.newPage();
  await page.goto(`${b.WEB}/car/${car.slug}`, { waitUntil: "networkidle" });
  const counter = async () =>
    (await page.locator("main").innerText()).match(/(\d+)\s*\/\s*(\d+)/)?.[0] ??
    null;
  const before = await counter();
  const box = await page.locator("main img").first().boundingBox();
  const cdp = await ctx.newCDPSession(page);
  const y = box.y + box.height / 2;
  const touch = (type, x) =>
    cdp.send("Input.dispatchTouchEvent", {
      type,
      touchPoints: type === "touchEnd" ? [] : [{ x, y }],
    });
  await touch("touchStart", box.x + box.width * 0.85);
  for (let i = 1; i <= 8; i += 1)
    await touch("touchMove", box.x + box.width * (0.85 - i * 0.08));
  await touch("touchEnd");
  await b.sleep(700);
  const after = await counter();
  await b.shot(page, "UAT-DISC-001-after-swipe");
  await ctx.close();
  r.ev({ before, after });
  return before && after && before !== after
    ? {
        layers: ["BROWSER"],
        note: `a left swipe on the phone gallery advances it (${before} → ${after})`,
      }
    : {
        status: "FAIL",
        layers: ["BROWSER"],
        note: `gallery counter ${before} → ${after} after a touch swipe`,
      };
});

await h.check(r, "UAT-DISC-002", async () => {
  const ctx = await b.context({ viewport: b.VIEWPORTS.mobile, mobile: true });
  const page = await ctx.newPage();
  await page.goto(`${b.WEB}/cars?fuel=diesel`, { waitUntil: "networkidle" });
  await page.locator(`a[href^="/car/"]`).first().click();
  await page.waitForURL(/\/car\//);
  const carUrl = new URL(page.url()).pathname;
  await page.goBack({ waitUntil: "commit" });
  await page.waitForURL(/\/cars/);
  const back = new URL(page.url()).pathname + new URL(page.url()).search;
  await page.goForward({ waitUntil: "commit" });
  await page.waitForURL(/\/car\//, { timeout: 15000 });
  const forward = new URL(page.url()).pathname;
  const h1 = (await page.locator("h1").first().textContent())?.trim();
  await ctx.close();
  r.ev({ carUrl, back, forward, h1 });
  return back === "/cars?fuel=diesel" && forward === carUrl && h1
    ? {
        layers: ["BROWSER"],
        note: `Back → ${back} (filter kept), Forward → the car again ("${h1}")`,
      }
    : {
        status: "FAIL",
        layers: ["BROWSER"],
        note: JSON.stringify({ back, forward, h1 }),
      };
});

r.save();
await b.close();
await h.pool.end();
