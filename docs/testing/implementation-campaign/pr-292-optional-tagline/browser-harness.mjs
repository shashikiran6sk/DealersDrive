import { chromium } from 'playwright-core';
const [out, slug] = process.argv.slice(2);
const b = await chromium.launch();
const res = {};
for (const w of [390, 1280]) {
  const p = await b.newPage({ viewport: { width: w, height: 900 } });
  await p.goto(`http://localhost:3000/dealers/${slug}`, { waitUntil: 'networkidle' });
  const t = await p.evaluate(() => document.body.innerText);
  res[`detail-${w}`] = {
    status: 'ok',
    placeholder:
      /no tagline|tagline provided|Quality pre-owned cars since 1998|null|undefined/i.test(t),
    overflow: await p.evaluate(() => document.documentElement.scrollWidth > innerWidth),
  };
  await p.screenshot({ path: `${out}/detail-no-tagline-${w}.png` });
  await p.close();
}
const p = await b.newPage({ viewport: { width: 390, height: 900 } });
await p.goto('http://localhost:3000/dealers', { waitUntil: 'networkidle' });
res.directory = await p.evaluate((s) => {
  const a = document.querySelector(`a[href="/dealers/${s}"]`);
  return { cardFound: !!a, cardText: a?.innerText.replace(/\s+/g, ' ').slice(0, 160) };
}, slug);
console.log(JSON.stringify(res, null, 1));
await b.close();
