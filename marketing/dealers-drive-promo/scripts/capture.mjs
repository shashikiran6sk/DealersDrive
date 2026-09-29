#!/usr/bin/env node
import { existsSync } from 'node:fs';
import { readFile, rm } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { openRecorder } from './lib/recorder.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const baseUrl = process.env.PROMO_WEB_URL ?? 'http://localhost:3000';
const device = process.argv.find((a) => a.startsWith('--device='))?.split('=')[1] ?? 'desktop';
const only = process.argv.find((a) => a.startsWith('--scene='))?.split('=')[1];
const outDir = join(root, 'recordings', device);

export const DEMO = {
  customerPhone: '9000020001',
  customerMessage: 'Hi, is the Creta still available? I would like to see it this Saturday.',
  dealerPhone: '9842010002',
  applicantPhone: '9000030001',
  otp: '123456',
  featuredDealerSlug: 'green-circle-motors-llp-vellore-tamil-nadu',
  heroCar: /2021 Hyundai Creta SX\(O\)/,
  reserveCar: 'Nexon',
  applicant: {
    fullName: 'Ravi Shankar',
    brandName: 'Metro Motors',
    legalName: 'Metro Motors and Traders',
    addressLine: '21, Officers Line, near Fort Round',
    city: 'Vellore',
    district: 'Vellore',
    state: 'Tamil Nadu',
    pincode: '632001',
    mapsUrl: 'https://www.google.com/maps/place/Vellore/@12.9202,79.1500,17z',
    tagline: 'Family SUVs and hatchbacks, inspected before they reach the yard.',
    services: ['Finance assistance', 'RC transfer', 'Exchange'],
    gstin: '33AAQFM4521K1Z6',
    pan: 'AAQFM4521K',
  },
};

const previous =
  only && existsSync(join(outDir, 'capture.json'))
    ? JSON.parse(await readFile(join(outDir, 'capture.json'), 'utf8'))
    : null;
if (!only) await rm(outDir, { recursive: true, force: true });
const rec = await openRecorder({ device, baseUrl, outDir });
if (previous) Object.assign(rec.meta.scenes, previous.scenes);
const { page } = rec;

async function signInByPhone(tab, phone) {
  const input = page.locator(tab === 'dealer' ? '#dealer-phone' : '#customer-phone');
  await input.click();
  await input.pressSequentially(phone, { delay: 35 });
  await page.locator('button:visible', { hasText: 'Send OTP' }).click();
  const otp = page.locator('input[autocomplete="one-time-code"]:visible');
  await otp.waitFor();
  return otp;
}

async function enterOtp(otp) {
  await otp.click();
  await page.keyboard.type(DEMO.otp, { delay: 60 });
}

const scenes = {
  async discover() {
    await rec.goto('/');
    await rec.snap('home');
    await rec.target('searchBox', page.getByPlaceholder(/Search make, model or variant/).first());
    await rec.target('browseAll', page.getByRole('link', { name: /Browse every car/ }).first());
    await rec.snap('home-page', { fullPage: 1400, pinHeader: 'header' });
    await page
      .getByRole('link', { name: /Browse every car/ })
      .first()
      .click();
    await page.waitForURL(/\/cars/);
    await rec.snap('cars');
    await rec.snap('cars-page', { fullPage: 1300, pinHeader: 'header' });
  },

  async search() {
    await rec.goto('/cars');
    await rec.snap('start');
    const district = page.getByRole('button', { name: /Select district/ }).last();
    await rec.target('district', district);
    await district.click();
    await page.getByRole('dialog').waitFor();
    await rec.snap('district-dialog');
    const vellore = page
      .getByRole('dialog')
      .getByRole('button', { name: /^Vellore/ })
      .first();
    await rec.target('vellore', vellore);
    await vellore.click();
    await page
      .getByRole('dialog')
      .waitFor({ state: 'hidden' })
      .catch(() => {});
    await rec.snap('vellore');
    const suv = page.locator('aside label', { hasText: /^SUV/ }).first();
    await suv.scrollIntoViewIfNeeded();
    await page.evaluate(() => window.scrollTo(0, 0));
    await rec.snap('rail-scrolled');
    await rec.target('suv', suv);
    await suv.click();
    await rec.snap('suv');
    const automatic = page.locator('aside label', { hasText: /^Automatic/ }).first();
    await rec.target('automatic', automatic);
    await automatic.click();
    await rec.snap('automatic');
    await rec.target('heroCard', page.locator('a', { hasText: DEMO.heroCar }).first());
  },

  async vehicle() {
    await rec.goto('/cars');
    const card = page.locator('a', { hasText: DEMO.heroCar }).first();
    const href = await card.getAttribute('href');
    await rec.goto(href);
    await rec.snap('vdp');
    const thumbs = page.locator(
      '[class*="gallery"] button, button[aria-label*="photo" i], button[aria-label*="image" i]',
    );
    const count = await thumbs.count();
    rec.meta.scenes.vehicle.thumbCount = count;
    for (const [i, n] of [1, 7, 4, 13].entries()) {
      const thumb = page
        .getByRole('button', { name: new RegExp(`(photo|image) ${String(n + 1)}\\b`, 'i') })
        .first();
      if (await thumb.count()) {
        await thumb.scrollIntoViewIfNeeded().catch(() => {});
        await rec.target(`thumb${String(i)}`, thumb);
        await thumb.click();
        await rec.snap(`photo-${String(n + 1)}`);
      }
    }
    await page.keyboard.press('Escape');
    await page
      .getByRole('dialog')
      .waitFor({ state: 'hidden' })
      .catch(() => {});
    await rec.target('viewDealership', page.getByText('View dealership').first());
    await rec.snap('vdp-closed');
    await rec.snap('vdp-page', { fullPage: 1800, pinHeader: 'header' });
  },

  async dealer() {
    await rec.goto(`/dealers/${DEMO.featuredDealerSlug}`);
    await rec.snap('portfolio');
    await rec.snap('portfolio-page', { fullPage: 1600, pinHeader: 'header' });
    await rec.goto('/dealers');
    await rec.snap('directory');
    await rec.snap('directory-page', { fullPage: 900, pinHeader: 'header' });
  },

  async enquiry() {
    await rec.goto('/cars');
    const href = await page.locator('a', { hasText: DEMO.heroCar }).first().getAttribute('href');
    await rec.goto(href);
    const enquire = page.locator('button:visible, a:visible', { hasText: 'Enquire now' }).first();
    await rec.target('enquire', enquire);
    await rec.snap('vdp');
    await enquire.click();
    await page.waitForURL(/\/login/);
    await rec.snap('login');
    await rec.target('phone', page.locator('#customer-phone'));
    const otp = await signInByPhone('customer', DEMO.customerPhone);
    await rec.snap('otp');
    await rec.target('otp', otp);
    await enterOtp(otp);
    await rec.snap('otp-filled');
    const verify = page.locator('button:visible', { hasText: /Verify/ });
    await rec.target('verify', verify);
    await verify.click();
    await page.waitForURL(/\/car\//);
    const message = page.locator('textarea[name="message"]');
    await message.waitFor();
    await message.scrollIntoViewIfNeeded();
    await rec.snap('form');
    await rec.target('message', message);
    await message.click();
    const words = DEMO.customerMessage.split(' ');
    for (let i = 0; i < words.length; i += 1) {
      await message.pressSequentially(`${i === 0 ? '' : ' '}${words[i]}`, { delay: 10 });
      if (i % 3 === 2 || i === words.length - 1)
        await rec.snap(`typing-${String(i).padStart(2, '0')}`, { wait: 60 });
    }
    const send = page.locator('button:visible', { hasText: 'Send enquiry' });
    await rec.target('send', send);
    await send.click();
    await page.waitForTimeout(800);
    await rec.snap('sent');
  },

  async onboarding() {
    await rec.goto('/login?as=dealer');
    await rec.snap('login');
    await rec.target('phone', page.locator('#dealer-phone'));
    const otp = await signInByPhone('dealer', DEMO.applicantPhone);
    await enterOtp(otp);
    await rec.snap('otp-filled');
    await page.locator('button:visible', { hasText: /Verify/ }).click();
    await page.waitForURL(/\/dealer\/onboarding/);
    await rec.snap('account');
    const name = page.locator('#fullName');
    await rec.target('fullName', name);
    await name.fill('');
    await name.pressSequentially(DEMO.applicant.fullName, { delay: 25 });
    await rec.snap('account-filled');
    const next = page.locator('button:visible', { hasText: /Continue to business details/ });
    await rec.target('continue', next);
    await next.click();
    await page.locator('#legalName, [name="legalName"]').first().waitFor();
    await rec.snap('business');
    const a = DEMO.applicant;
    const fill = async (selector, value) => {
      const field = page.locator(selector).first();
      if ((await field.count()) === 0) return;
      const tag = await field.evaluate((node) => node.tagName);
      if (tag === 'SELECT') await field.selectOption({ label: value });
      else {
        await field.fill('');
        await field.pressSequentially(value, { delay: 4 });
      }
    };
    await fill('[name="legalName"]', a.brandName);
    await fill('[name="addressLine"]', a.addressLine);
    await fill('[name="city"]', a.city);
    await fill('[name="district"]', a.district);
    await fill('[name="state"]', a.state);
    await fill('[name="pincode"]', a.pincode);
    await fill('[name="mapsUrl"]', a.mapsUrl);
    await fill('[name="tagline"]', a.tagline);
    const serviceInput = page.locator('input#specialities');
    for (const service of a.services) {
      await serviceInput.fill(service);
      await page.getByRole('button', { name: 'Add', exact: true }).click();
    }
    await page.evaluate(() => window.scrollTo(0, 0));
    await rec.snap('business-filled');
    await rec.snap('business-page', { fullPage: 1600 });
    const cont = page.getByRole('button', { name: 'Continue', exact: true });
    await cont.scrollIntoViewIfNeeded();
    await rec.target('businessContinue', cont);
    await cont.click();
    await page.locator('#gstin').waitFor({ timeout: 15000 });
    await page.evaluate(() => window.scrollTo(0, 0));
    await rec.snap('documents');
    await fill('#gstin', a.gstin);
    await fill('#pan', a.pan);
    const saveIds = page.getByRole('button', { name: 'Save registrations' });
    await rec.target('saveIds', saveIds);
    await saveIds.click();
    await page.waitForTimeout(1200);
    await rec.snap('registrations-saved');
    const files = page.locator('input[type="file"]');
    const count = await files.count();
    const docs = ['gst', 'pan', 'address'].map((kind) =>
      join(root, 'assets', 'generated', 'documents', `${kind}.jpg`),
    );
    const yard = join(root, 'assets', 'generated', 'dealers', 'metro-motors-vellore', 'yard.jpg');
    for (let i = 0; i < count; i += 1) {
      const input = files.nth(i);
      const accept = (await input.getAttribute('accept')) ?? '';
      const label = await input.evaluate(
        (node) => node.closest('section, article, div')?.textContent?.slice(0, 80) ?? '',
      );
      const file = /yard/i.test(label) || i === count - 1 ? yard : docs[i % 3];
      rec.meta.scenes.onboarding[`upload${String(i)}`] = { accept, label, file };
      await input.setInputFiles(file);
      await page.waitForTimeout(1200);
    }
    await rec.snap('documents-uploaded');
    await rec.snap('documents-page', { fullPage: 2200 });
    rec.meta.scenes.onboarding.documentsText = (await page.locator('main').innerText()).slice(
      0,
      3000,
    );
    const save = page.getByRole('button', { name: 'Continue', exact: true });
    await save.scrollIntoViewIfNeeded();
    await rec.target('documentsContinue', save);
    await save.click();
    await page.waitForTimeout(1500);
    await page.evaluate(() => window.scrollTo(0, 0));
    await rec.snap('after-documents');
    rec.meta.scenes.onboarding.afterDocumentsText = (await page.locator('main').innerText()).slice(
      0,
      3000,
    );
    const submit = page.getByRole('button', { name: 'Submit for verification' });
    await rec.target('submit', submit);
    await submit.click();
    await page.waitForTimeout(2000);
    await page.evaluate(() => window.scrollTo(0, 0));
    await rec.snap('submitted');
    rec.meta.scenes.onboarding.submittedText = (await page.locator('body').innerText()).slice(
      0,
      2000,
    );
  },

  async console() {
    await rec.goto('/login?as=dealer');
    const otp = await signInByPhone('dealer', DEMO.dealerPhone);
    await enterOtp(otp);
    await page.locator('button:visible', { hasText: /Verify/ }).click();
    await page.waitForURL(/\/dealer(\/|$)/);
    await rec.goto('/dealer');
    await rec.snap('dashboard');
    await rec.target('navProfile', page.getByRole('link', { name: 'Dealer profile' }).first());
    await rec.target('navInventory', page.getByRole('link', { name: 'Inventory' }).first());
    await rec.target('navEnquiries', page.getByRole('link', { name: 'Enquiries' }).first());
    await rec.goto('/dealer/profile');
    await rec.snap('profile');
    await rec.goto('/dealer/inventory');
    await rec.snap('inventory');
    const row = page.locator('tr', { hasText: DEMO.reserveCar });
    const reserve = row.getByRole('button', { name: 'Reserve' });
    await rec.target('reserve', reserve);
    await reserve.click();
    await page
      .getByRole('dialog')
      .waitFor()
      .catch(() => {});
    await rec.snap('reserve-dialog');
    const confirm = page.getByRole('button', { name: 'Reserve vehicle' });
    await rec.target('confirmReserve', confirm);
    await confirm.click();
    await page
      .getByRole('dialog')
      .waitFor({ state: 'hidden' })
      .catch(() => {});
    await rec.snap('reserved');
    for (const status of ['Reserved', 'Sold', 'Withdrawn']) {
      const chip = page
        .locator('main a, main button')
        .filter({ hasText: new RegExp(`^${status}\\s*\\d`) })
        .first();
      await rec.target(`chip${status}`, chip);
      await chip.click();
      await page.waitForTimeout(400);
      await rec.snap(`status-${status.toLowerCase()}`);
    }
    await rec.goto('/dealer/vehicles/new');
    await rec.snap('add-vehicle');
    await rec.goto('/dealer/enquiries');
    await rec.snap('enquiries');
    const arjun = page
      .locator('article, li, section, div')
      .filter({ hasText: /^.*Arjun Raman/ })
      .last();
    const contacted = page.getByRole('button', { name: 'Mark contacted' }).first();
    await rec.target('markContacted', contacted);
    await contacted.click();
    await page.waitForTimeout(700);
    await rec.snap('contacted');
    rec.meta.scenes.console.arjunVisible = (await arjun.count()) > 0;
    await rec.goto('/dealer');
    await rec.snap('dashboard-after');
  },
};

const mobileScenes = {
  async discover() {
    await rec.goto('/');
    await rec.snap('home');
    await rec.goto('/cars');
    await rec.snap('cars');
    await rec.snap('cars-page', { fullPage: 1600, pinHeader: 'header' });
  },

  async search() {
    await rec.goto('/cars');
    const filters = page.getByRole('button', { name: /^Filters/ }).first();
    await rec.target('filters', filters);
    await filters.click();
    const sheet = page.getByRole('dialog');
    await sheet.waitFor();
    await rec.snap('sheet');
    const suv = sheet.locator('label', { hasText: /^SUV/ }).first();
    await suv.scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);
    await rec.snap('sheet-body');
    await rec.target('suv', suv);
    await suv.click();
    await rec.snap('suv');
    const automatic = sheet.locator('label', { hasText: /^Automatic/ }).first();
    await automatic.scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);
    await rec.snap('sheet-transmission');
    await rec.target('automatic', automatic);
    await automatic.click();
    await rec.snap('automatic');
    const show = sheet.getByRole('button', { name: /^Show \d+ cars?/ });
    await rec.target('show', show);
    await show.click();
    await sheet.waitFor({ state: 'hidden' }).catch(() => {});
    await page.evaluate(() => window.scrollTo(0, 0));
    await rec.snap('results');
  },

  async vehicle() {
    await rec.goto('/cars');
    const href = await page.locator('a', { hasText: DEMO.heroCar }).first().getAttribute('href');
    await rec.goto(href);
    await rec.snap('vdp');
    const all = page.locator('button:visible', { hasText: 'view all' }).first();
    await rec.target('viewAll', all);
    await all.click();
    await page.getByRole('dialog').waitFor();
    await rec.snap('photo-1');
    const next = page.getByRole('dialog').getByRole('button', { name: /next/i }).first();
    for (const n of [2, 3, 4, 5, 6, 14]) {
      if (n === 14) {
        for (let i = 6; i < 14; i += 1) await next.click();
      } else await next.click();
      if (n === 2) await rec.target('next', next);
      await page.waitForTimeout(250);
      await rec.snap(`photo-${String(n)}`);
    }
    await page.keyboard.press('Escape');
    await page
      .getByRole('dialog')
      .waitFor({ state: 'hidden' })
      .catch(() => {});
    await rec.snap('vdp-page', { fullPage: 2200, pinHeader: 'header' });
  },

  async dealer() {
    await rec.goto(`/dealers/${DEMO.featuredDealerSlug}`);
    await rec.snap('portfolio-page', { fullPage: 1400, pinHeader: 'header' });
    await rec.goto('/dealers');
    await rec.snap('directory-page', { fullPage: 1200, pinHeader: 'header' });
  },

  async enquiry() {
    await rec.goto('/cars');
    const href = await page.locator('a', { hasText: DEMO.heroCar }).first().getAttribute('href');
    await rec.goto(href);
    const enquire = page.locator('button:visible, a:visible', { hasText: 'Enquire now' }).last();
    await rec.target('enquire', enquire);
    await rec.snap('vdp');
    await enquire.click();
    await page.waitForURL(/\/login/);
    await rec.snap('login');
    await rec.target('phone', page.locator('#customer-phone'));
    const otp = await signInByPhone('customer', DEMO.customerPhone);
    await enterOtp(otp);
    await rec.snap('otp-filled');
    const verify = page.locator('button:visible', { hasText: /Verify/ });
    await rec.target('verify', verify);
    await verify.click();
    await page.waitForURL(/\/car\//);
    const message = page.locator('textarea[name="message"]');
    await message.waitFor();
    await message.scrollIntoViewIfNeeded();
    await rec.snap('form');
    await message.click();
    await message.pressSequentially(DEMO.customerMessage, { delay: 5 });
    await rec.snap('typed');
    const send = page.locator('button:visible', { hasText: 'Send enquiry' });
    await rec.target('send', send);
    await send.click();
    await page.waitForTimeout(900);
    await rec.snap('sent');
  },

  async onboarding() {
    await rec.goto('/login?as=dealer');
    const otp = await signInByPhone('dealer', DEMO.applicantPhone);
    await enterOtp(otp);
    await rec.snap('login-otp');
    await page.locator('button:visible', { hasText: /Verify/ }).click();
    await page.waitForURL(/\/dealer\/onboarding/);
    await rec.snap('account');
  },

  async console() {
    await rec.goto('/login?as=dealer');
    const otp = await signInByPhone('dealer', DEMO.dealerPhone);
    await enterOtp(otp);
    await page.locator('button:visible', { hasText: /Verify/ }).click();
    await page.waitForURL(/\/dealer(\/|$)/);
    await rec.goto('/dealer');
    await rec.snap('dashboard');
    await rec.goto('/dealer/inventory');
    await rec.snap('inventory');
    await rec.snap('inventory-page', { fullPage: 1800 });
    await rec.goto('/dealer/enquiries');
    await rec.snap('enquiries');
  },
};

const active = device === 'mobile' ? mobileScenes : scenes;
for (const [name, fn] of Object.entries(active)) {
  if (only && !only.split(',').includes(name)) continue;
  console.log(`scene: ${name}`);
  await rm(join(outDir, name), { recursive: true, force: true });
  try {
    await rec.scene(name, fn);
  } catch (error) {
    rec.problems.push(`scene ${name} failed: ${error.message.split('\n')[0]}`);
    console.error(`  ✗ ${error.message.split('\n')[0]}`);
    await page.screenshot({ path: join(outDir, `${name}-FAILED.png`) }).catch(() => {});
  }
}
await rec.save();
await rec.close();
console.log(
  rec.problems.length
    ? `Problems:\n  ${rec.problems.join('\n  ')}`
    : 'Capture clean — no console errors, failed requests or broken images.',
);
