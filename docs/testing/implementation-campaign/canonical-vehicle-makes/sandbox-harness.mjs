import { chromium } from 'playwright-core';
const [out] = process.argv.slice(2);
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 420, height: 420 } });
const res = {};
for (const story of ['empty', 'selected', 'alias-resolves-to-brand', 'saved-outside-list', 'invalid', 'disabled']) {
  const errors = [];
  p.removeAllListeners('pageerror'); p.on('pageerror', (e) => errors.push(String(e)));
  await p.goto(`http://localhost:6006/iframe.html?id=forms-vehiclemakeselect--${story}&viewMode=story`, { waitUntil: 'networkidle' });
  await p.waitForTimeout(800);
  const box = p.getByRole('combobox');
  const r = { value: await box.inputValue(), disabled: await box.isDisabled(), errors };
  if (!r.disabled) { await box.click(); r.firstOptions = (await p.getByRole('option').allInnerTexts()).slice(0, 3); }
  await p.screenshot({ path: `${out}/sandbox-${story}.png` });
  res[story] = r;
}
console.log(JSON.stringify(res, null, 1));
await b.close();
