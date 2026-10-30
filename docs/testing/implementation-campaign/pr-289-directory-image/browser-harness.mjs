import { chromium } from 'playwright-core';
const out = process.argv[2]; const b = await chromium.launch(); const res = [];
for (const w of [320, 390, 768, 1280]) {
  const p = await b.newPage({ viewport: { width: w, height: 900 } });
  const failed = []; p.on('response', r => { if (r.status() >= 400) failed.push(r.status() + ' ' + r.url()); });
  await p.goto('http://localhost:3000/dealers', { waitUntil: 'networkidle' });
  const r = await p.evaluate(() => {
    const imgs = [...document.querySelectorAll('main img')];
    const covers = imgs.filter(i => (i.currentSrc || i.src).includes('dealer-directory-cover'));
    return {
      cards: document.querySelectorAll('main a[href^="/dealers/"]').length,
      coverImgs: covers.length, coversLoaded: covers.filter(i => i.complete && i.naturalWidth > 0).length,
      otherMainImgs: imgs.length - covers.length,
      yardVerifiedText: document.body.innerText.includes('YARD VERIFIED'),
      verifiedDealerText: (document.body.innerText.match(/VERIFIED DEALER/g) || []).length,
      overflow: document.documentElement.scrollWidth > innerWidth,
    };
  });
  await p.screenshot({ path: `${out}/dealers-${w}.png`, fullPage: false });
  res.push({ width: w, ...r, failed }); await p.close();
}
console.log(JSON.stringify(res, null, 1)); await b.close();
