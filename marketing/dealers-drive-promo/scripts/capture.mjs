import { chromium } from 'playwright';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { WEB, API, PROMO } from './environment.mjs';
const format = process.argv[2] || 'landscape';
const viewport = {
  landscape: { width: 1440, height: 760 },
  vertical: { width: 440, height: 660 },
  social: { width: 760, height: 780 },
}[format];
if (!viewport) throw Error('Unknown format');
const from = Number(process.argv[3] || 0);
const until = Number(process.argv[4] || 10);
const story = JSON.parse(await readFile(resolve(PROMO, 'story.json')));
const out = resolve(PROMO, 'recordings', format);
await mkdir(out, { recursive: true });
const browser = await chromium.launch({
  channel: 'chrome',
  headless: true,
  args: ['--window-size=1920,1200'],
});
const context = await browser.newContext({
  viewport,
  deviceScaleFactor: 2,
  locale: 'en-IN',
  timezoneId: 'Asia/Kolkata',
});
const page = await context.newPage();
page.setDefaultTimeout(15000);
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('response', (r) => {
  if (r.status() >= 400 && r.url().startsWith(API))
    errors.push(`${r.status()} ${new URL(r.url()).pathname}`);
});
const cdp = await context.newCDPSession(page);
const pause = (ms) => page.waitForTimeout(ms);
async function clean() {
  await page.addStyleTag({
    content: `nextjs-portal{display:none!important}html{scroll-behavior:smooth}*{cursor:none!important}`,
  });
  await page
    .getByText(/^local — not real data$/i)
    .evaluateAll((ns) => ns.forEach((n) => (n.style.display = 'none')));
  await page.evaluate(() => {
    if (!document.getElementById('promo-cursor')) {
      const n = document.createElement('div');
      n.id = 'promo-cursor';
      n.style.cssText =
        'position:fixed;z-index:2147483646;left:0;top:0;pointer-events:none;transform:translate(-100px,-100px);filter:drop-shadow(0 2px 2px #0004)';
      n.innerHTML =
        '<svg width="22" height="28" viewBox="0 0 22 28"><path d="M2 1L19 17L11 18L7 25Z" fill="white" stroke="#171716" stroke-width="1.5"/></svg>';
      document.body.append(n);
    }
  });
}
async function ready() {
  await page.waitForLoadState('networkidle');
  await page.evaluate(() => document.fonts.ready);
  await clean();
  await pause(300);
  const broken = await page
    .locator('img')
    .evaluateAll((ns) => ns.filter((n) => n.complete && n.naturalWidth === 0).map((n) => n.alt));
  if (broken.length) throw Error('Broken images ' + broken);
}
async function go(path) {
  await page.goto(WEB + path);
  await ready();
}
async function login(role, phone) {
  await context.clearCookies();
  const r = await context.request.post(`${API}/v1/auth/sign-in/phone/${role}`, {
    data: { phone, accessToken: `dev-otp:91${phone}:123456:${format}:${Date.now()}` },
  });
  if (!r.ok()) throw Error(`Sign in ${r.status()} ${await r.text()}`);
}
let pointer = { x: 50, y: 50 };
async function click(locator) {
  await locator.scrollIntoViewIfNeeded();
  await pause(300);
  const b = await locator.boundingBox();
  const x = b.x + b.width / 2,
    y = b.y + b.height / 2;
  for (let i = 1; i <= 18; i++) {
    const t = i / 18,
      u = t * t * (3 - 2 * t);
    const px = pointer.x + (x - pointer.x) * u,
      py = pointer.y + (y - pointer.y) * u;
    await page.mouse.move(px, py);
    await page.evaluate(
      ({ x, y }) => {
        document.getElementById('promo-cursor').style.transform = `translate(${x}px,${y}px)`;
      },
      { x: px, y: py },
    );
    await pause(18);
  }
  pointer = { x, y };
  await locator.click();
  await pause(500);
}
async function type(selector, text) {
  const l = page.locator(selector);
  await click(l);
  await l.fill('');
  await l.pressSequentially(text, { delay: 34 });
  await pause(300);
}
async function scroll(y) {
  await page.evaluate((y) => window.scrollBy({ top: y, behavior: 'smooth' }), y);
  await pause(1100);
}
const shots = [];
async function reactivateShot() {
  await shot('reactivate', 5, async () => {
    await click(page.getByRole('button', { name: 'Make active', exact: true }).first());
    await click(page.getByRole('dialog').getByRole('button', { name: 'Make active', exact: true }));
    await page.getByRole('dialog').waitFor({ state: 'hidden' });
    await pause(700);
  });
}
async function shot(name, seconds, action = async () => {}) {
  console.log('Recording', name);
  await clean();
  await pause(150);
  const dir = resolve(out, name);
  await mkdir(dir, { recursive: true });
  const frames = [];
  let active = true;
  const start = Date.now();
  const recording = (async () => {
    while (active) {
      const t = (Date.now() - start) / 1000;
      const file = `${String(frames.length).padStart(5, '0')}.jpg`;
      await page.screenshot({ path: resolve(dir, file), type: 'jpeg', quality: 95 });
      frames.push({ file, t });
      await pause(25);
    }
  })();
  try {
    await pause(650);
    await action();
    await pause(Math.max(800, seconds * 1000 - (Date.now() - start)));
  } finally {
    active = false;
    await recording;
  }
  const duration = (Date.now() - start) / 1000;
  let concat = 'ffconcat version 1.0\n';
  frames.forEach((f, i) => {
    concat += `file '${f.file}'\nduration ${Math.max(0.016, (frames[i + 1]?.t ?? duration) - f.t).toFixed(6)}\n`;
  });
  concat += `file '${frames.at(-1).file}'\n`;
  await writeFile(resolve(dir, 'frames.ffconcat'), concat);
  await page.screenshot({ path: resolve(dir, 'end.png') });
  shots.push({ name, duration, frames: frames.length });
  await writeFile(resolve(out, 'shots.json'), JSON.stringify(shots, null, 2));
}

try {
  if (from <= 2 && until >= 2) {
    await go('/');
    await shot('home', 3, () => scroll(140));
    await go('/cars');
    await shot('cars', 6, () => scroll(180));
  }
  if (from <= 3 && until >= 3) {
    await go('/cars');
    await shot('filters', 9, async () => {
      if (viewport.width < 1024)
        await click(page.getByRole('button', { name: 'Filters', exact: true }));
      await click(page.getByRole('checkbox', { name: /^Honda / }));
      if (viewport.width < 1024) await click(page.getByRole('button', { name: /Show .* cars/ }));
      await type('input[placeholder="Search make, model or variant"]', 'Elevate');
      await page.getByRole('combobox').first().press('Enter');
      await pause(700);
      await page.getByRole('combobox').first().press('Escape');
      await pause(900);
    });
  }
  if (from <= 4 && until >= 4) {
    await go('/car/' + story.featured.slug);
    await shot('portfolio', 3);
    await shot('gallery', 6, async () => {
      await click(page.getByRole('button', { name: /View all .* photos/ }));
      await click(page.getByRole('button', { name: 'Next photo', exact: true }));
      await pause(700);
      await click(page.getByRole('button', { name: 'Next photo', exact: true }));
      await click(page.getByRole('button', { name: 'Next photo', exact: true }));
    });
    await click(page.getByRole('button', { name: /Close/ }).first());
    await scroll(520);
    await shot('specifications', 3);
  }
  if (from <= 5 && until >= 5) {
    await go('/dealers');
    await shot('dealers', 4, () => scroll(100));
    await go('/dealers/' + story.featured.dealerSlug);
    await shot('dealer', 5, () => scroll(300));
  }
  if (from <= 6 && until >= 6) {
    await login('customer', story.customerPhone);
    await go('/car/' + story.featured.slug);
    const save = page.getByRole('button', { name: 'Save 2024 Honda Elevate VX', exact: true });
    if (await save.count()) await click(save.first());
    await click(page.getByRole('button', { name: 'Enquire now', exact: true }).first());
    await shot('enquiry', 7, async () => {
      await type(
        'textarea',
        'Hi, I am interested in this Elevate. Can I visit your showroom this weekend?',
      );
      await click(page.getByRole('button', { name: 'Send enquiry', exact: true }));
      await page.getByText('Enquiry sent', { exact: true }).waitFor();
    });
    await go('/enquiries');
    await shot('history', 3);
    await go('/saved');
    await shot('saved', 2);
  }
  if (from <= 7 && until >= 7) {
    await login('dealer', story.newcomerPhone);
    await go('/dealer/onboarding');
    await shot('account', 2);
    await click(page.getByRole('button', { name: 'Continue to business details' }));
    await page.locator('#legalName').fill('Metro Motors Demo');
    await page.locator('#addressLine').fill('24 Demonstration Road');
    await page.locator('#city').fill('Vellore');
    await page.locator('#district').fill('Vellore');
    await page.locator('#state').fill('Tamil Nadu');
    await page.locator('#pincode').fill('632001');
    await page.locator('#mapsUrl').fill('https://www.google.com/maps?q=Vellore');
    await page
      .locator('#tagline')
      .fill('Explore our multi-brand inventory and arrange a visit to our yard.');
    await page.locator('#specialities').fill('Exchange');
    await page.getByRole('button', { name: 'Add', exact: true }).click();
    await page.evaluate(() => scrollTo(0, 0));
    await pause(700);
    await shot('business', 6, async () => {
      await type('#legalName', 'Metro Motors Demo');
      await scroll(400);
      await click(page.getByRole('button', { name: 'Continue', exact: true }));
      await page.getByRole('heading', { name: 'Business verification' }).waitFor();
    });
    await shot('documents', 3);
  }
  if (from <= 8 && until >= 8) {
    await login('dealer', story.dealerPhone);
    await go('/dealer');
    await shot('dashboard', 4);
    await go('/dealer/profile');
    await shot('profile', 5, async () => {
      const input = page.locator('[name="establishedYear"]');
      await input.fill('2012');
      await click(page.getByRole('button', { name: 'Save changes', exact: true }));
    });
  }
  if (from <= 9 && until >= 9) {
    await login('dealer', story.dealerPhone);
    await go('/dealer/inventory');
    await shot('inventory', 4);
    await go(`/dealer/vehicles/${story.draftId}/edit?step=review`);
    await shot('submit', 5, async () => {
      await click(page.getByRole('button', { name: 'Submit for review', exact: true }));
      await page.getByText('Submitted for review', { exact: true }).waitFor();
    });
    await go('/dealer/inventory');
    const card = page.locator('tr:visible,li:visible').filter({ hasText: 'Honda Elevate' }).first();
    await shot('reserve', 5, async () => {
      await click(card.getByRole('button', { name: 'Reserve', exact: true }));
      await click(page.getByRole('button', { name: 'Reserve vehicle', exact: true }));
      await pause(700);
    });
    await reactivateShot();
  }
  if (from === 11) {
    await login('dealer', story.dealerPhone);
    await go('/dealer/inventory');
    const car = page.locator('tr:visible,li:visible').filter({ hasText: 'Honda Elevate' }).first();
    if (await car.getByRole('button', { name: 'Reserve', exact: true }).count()) {
      await click(car.getByRole('button', { name: 'Reserve', exact: true }));
      await click(page.getByRole('button', { name: 'Reserve vehicle', exact: true }));
    }
    await reactivateShot();
  }
  if (from <= 10 && until >= 10) {
    await login('dealer', story.dealerPhone);
    await go('/dealer/enquiries');
    if (!(await page.getByRole('button', { name: 'Mark contacted', exact: true }).count())) {
      await go('/dealer/enquiries?status=CONTACTED');
      await click(page.getByRole('button', { name: 'Close', exact: true }).first());
      await go('/dealer/enquiries?status=CLOSED');
      await click(page.getByRole('button', { name: 'Reopen', exact: true }).first());
      await go('/dealer/enquiries');
    }
    await shot('inbox', 9, async () => {
      await pause(1500);
      await click(page.getByRole('button', { name: 'Mark contacted', exact: true }).first());
      await click(page.getByRole('link', { name: /^Contacted/ }));
      await pause(1500);
    });
  }
  await writeFile(
    resolve(out, 'qa.json'),
    JSON.stringify({ format, viewport, errors, shots }, null, 2),
  );
  if (errors.length) throw Error(errors.join('\n'));
} catch (e) {
  await page.screenshot({ path: resolve(out, 'failure.png') });
  await writeFile(
    resolve(out, 'failure.txt'),
    String(e) + '\n' + (await page.locator('body').innerText()),
  );
  throw e;
} finally {
  await browser.close();
}
