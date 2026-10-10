import { chromium } from 'playwright';
const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
});
for (const w of [1440, 390]) {
  const page = await (await browser.newContext({ viewport: { width: w, height: 900 } })).newPage();
  await page.goto('http://localhost:3000/this-route-does-not-exist-209', {
    waitUntil: 'networkidle',
  });
  const links = await page.$$eval('main a[href="/"]', (as) =>
    as.map((a) => ({ text: a.textContent.trim(), visible: !!(a.offsetWidth || a.offsetHeight) })),
  );
  console.log(w, JSON.stringify(links));
  await page.getByRole('link', { name: 'Go to homepage' }).click();
  await page
    .waitForURL((u) => u.pathname === '/', { timeout: 10000 })
    .then(() => console.log(w, 'navigated', page.url()))
    .catch((e) => console.log(w, 'NO NAV', page.url()));
  const cars = await page.goto('http://localhost:3000/this-route-does-not-exist-209', {
    waitUntil: 'networkidle',
  });
  await page.getByRole('link', { name: 'Browse cars' }).click();
  await page
    .waitForURL((u) => u.pathname === '/cars', { timeout: 10000 })
    .then(() => console.log(w, 'cars ok'))
    .catch(() => console.log(w, 'cars NO NAV'));
}
await browser.close();
