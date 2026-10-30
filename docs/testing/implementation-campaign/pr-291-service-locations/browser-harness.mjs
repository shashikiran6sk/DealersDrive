import { chromium } from 'playwright-core';
import { readFileSync } from 'node:fs';
const [out, S] = process.argv.slice(2);
const tok = (n) => readFileSync(`${S}/tok-${n}`, 'utf8').trim();
const b = await chromium.launch();
const res = {};
async function page(token, w) {
  const ctx = await b.newContext({ viewport: { width: w, height: 900 } });
  if (token)
    await ctx.addCookies([{ name: 'dd_session', value: token, domain: 'localhost', path: '/' }]);
  const p = await ctx.newPage();
  const failed = [];
  p.on('response', (r) => {
    if (r.status() >= 500) failed.push(r.status() + ' ' + r.url());
  });
  return { p, ctx, failed };
}
// 1. admin config editor
for (const w of [390, 1280]) {
  const { p, ctx, failed } = await page(tok('SUPER_ADMIN'), w);
  await p.goto('http://localhost:3000/admin/config', { waitUntil: 'networkidle' });
  const info = await p.evaluate(() => ({
    url: location.pathname,
    hasEditor: /service location/i.test(document.body.innerText),
    tamilNadu: document.body.innerText.includes('Tamil Nadu'),
    ariyalur: document.body.innerText.includes('Ariyalur'),
    overflow: document.documentElement.scrollWidth > innerWidth,
  }));
  await p.screenshot({ path: `${out}/admin-config-${w}.png`, fullPage: false });
  const sec = p.getByText(/service location/i).first();
  if (await sec.count()) {
    await sec.scrollIntoViewIfNeeded();
    await p.screenshot({ path: `${out}/admin-config-editor-${w}.png` });
  }
  res[`admin-config-${w}`] = { ...info, failed };
  await ctx.close();
}
// 2. sales rep edits an assisted draft: state select + district combobox
{
  const { p, ctx, failed } = await page(tok('arun'), 390);
  await p.goto('http://localhost:3000/sales/dealers/6db753d7-4259-4270-8cd9-b97c2c705d60', {
    waitUntil: 'networkidle',
  });
  const state = p.locator('select[name="state"]').first();
  const district = p.locator('input[role="combobox"]').first();
  const before = {
    state: (await state.count()) ? await state.inputValue() : null,
    district: (await district.count()) ? await district.inputValue() : null,
  };
  let picked = null,
    options = null;
  if (await district.count()) {
    options = {};
    for (const q of ['trichy', 'tuticorin', 'kanchipuram', 'nilgiris', 'tiruchi']) {
      await district.click();
      await district.fill(q);
      options[q] = await p.locator('[role="listbox"] li').allInnerTexts();
    }
    await p.locator('[role="listbox"] button', { hasText: 'Tiruchirappalli' }).click();
    picked = {
      visible: await district.inputValue(),
      hidden: await p.locator('input[type="hidden"][name="district"]').first().inputValue(),
    };
  }
  await p.screenshot({ path: `${out}/sales-draft-location-390.png`, fullPage: false });
  const loc = p.locator('select[name="state"]').first();
  if (await loc.count()) {
    await loc.scrollIntoViewIfNeeded();
    await p.screenshot({ path: `${out}/sales-draft-location-fields-390.png` });
  }
  res['sales-draft-390'] = {
    url: p.url(),
    before,
    options,
    picked,
    overflow: await p.evaluate(() => document.documentElement.scrollWidth > innerWidth),
    failed,
  };
  await ctx.close();
}
// 3. legacy district links on the public directory
for (const d of ['tiruchirappalli', 'trichy', 'the-nilgiris', 'nilgiris']) {
  const { p, ctx } = await page(null, 1280);
  await p.goto(`http://localhost:3000/dealers?district=${d}`, { waitUntil: 'networkidle' });
  res[`dealers?district=${d}`] = await p.evaluate(() => ({
    cards: document.querySelectorAll('main a[href^="/dealers/"]').length,
    heading: document.querySelector('main p, main h1 + *')?.textContent?.slice(0, 80),
  }));
  await ctx.close();
}
console.log(JSON.stringify(res, null, 1));
await b.close();
