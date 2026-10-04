import { chromium } from 'playwright';
import { readFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { PROMO, REPO } from './environment.mjs';
import { scenes } from './scenes.mjs';
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const font = await readFile(resolve(PROMO, 'assets/fonts/manrope-latin.woff2'));
const car = await readFile(resolve(PROMO, 'assets/brand/opening-car.png'));
const yard = await readFile(resolve(PROMO, 'assets/dealers/dealer-1.png'));
for (const [format, w, h, scale] of [
  ['landscape', 1920, 1080, 2],
  ['vertical', 1080, 1920, 1],
  ['social', 1080, 1350, 1],
]) {
  const page = await browser.newPage({
    viewport: { width: w, height: h },
    deviceScaleFactor: scale,
  });
  const out = resolve(PROMO, 'scenes', format);
  await mkdir(out, { recursive: true });
  for (const [i, s] of scenes.entries()) {
    const special = i === 0 || i === 11,
      portrait = w < h,
      margin = portrait ? 64 : 80;
    const title = portrait && s.label.length > 29 ? s.label.replace('. ', '.<br>') : s.label;
    const css = `@font-face{font-family:Manrope;src:url(data:font/woff2;base64,${font.toString('base64')});font-weight:100 900}*{box-sizing:border-box}body{margin:0;width:${w}px;height:${h}px;font-family:Manrope;color:#181916;background:#f1f1ed;overflow:hidden}.label{font-size:${portrait ? 22 : 15}px;letter-spacing:.17em;text-transform:uppercase;color:#666b60}.brand{display:flex;align-items:center;gap:14px;font-weight:800;font-size:26px}.mark{display:grid;place-items:center;width:46px;height:46px;border-radius:11px;background:#151613;color:#fff;font-size:17px}h1{font-size:${portrait ? 52 : 43}px;font-weight:800;letter-spacing:-.035em;margin:15px 0;line-height:1.15}.rule{height:1px;background:#d3d5cd}.bottom{position:absolute;bottom:26px;left:${margin}px;right:${margin}px;display:flex;justify-content:space-between;font-size:${portrait ? 18 : 12}px;color:#63675e;letter-spacing:.06em}`;
    let html;
    if (special) {
      html = `<style>${css}</style><img src="data:image/png;base64,${(i === 0 ? car : yard).toString('base64')}" style="position:absolute;width:100%;height:100%;object-fit:cover;object-position:${portrait ? '58%' : 'center'}"><div style="position:absolute;inset:0;background:linear-gradient(${portrait ? '0deg' : '90deg'},#0b100ce8,#0b100c36)"></div><div style="position:absolute;left:${margin}px;right:${margin}px;top:${portrait ? '12%' : '13%'};color:white"><div class="brand"><span class="mark" style="background:white;color:#171916">DD</span>Dealers-Drive</div><div style="margin-top:${portrait ? '500' : '245'}px"><div class="label" style="color:#d1d7c9">${i === 0 ? 'Cars. Dealerships. Possibilities.' : 'Discover. Connect. Drive.'}</div><h1 style="font-size:${portrait ? 82 : 96}px;max-width:1000px">${i === 0 ? 'Find your<br>next car.' : 'Your next chapter<br>starts here.'}</h1><p style="font-size:${portrait ? 30 : 28}px;line-height:1.5;max-width:750px;color:#e3e7de">${i === 0 ? 'Explore used cars.<br>Meet the dealership behind them.' : 'A better digital marketplace<br>for used cars.'}</p></div></div><div class="bottom" style="color:#d5dbce"><span>DEALERS-DRIVE</span><span>${i === 0 ? 'FOR THE ROAD AHEAD' : 'EXPLORE • ENQUIRE • DRIVE'}</span></div>`;
    } else {
      html = `<style>${css}</style><div style="position:absolute;left:${margin}px;right:${margin}px;top:${portrait ? 60 : 30}px"><div class="label">${i < 6 ? 'For car buyers' : 'For dealerships'} <span style="float:right">${String(i).padStart(2, '0')} / 10</span></div><h1>${title}</h1></div><div class="bottom"><span>DEALERS-DRIVE</span><span>${i < 6 ? 'FIND YOUR NEXT CAR' : 'YOUR DIGITAL SHOWROOM'}</span></div>`;
    }
    await page.setContent(html);
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: resolve(out, s.id + '-plate.png') });
  }
  await page.close();
}
await browser.close();
