// Browser kit for the certification campaigns (Playwright + the session's Chromium).
// Provenance: sessions are either created through the real web sign-in UI
// (FAKE-OTP: the API's fake OTP driver, the web's dev-otp token) or taken from a
// real API sign-in and placed in the browser's cookie jar (FAKE-OTP cookie), or an
// inserted ADMIN session (SIM-SESSION). Real Google/MSG91 are never exercised.
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

import { chromium } from '/tmp/claude-0/-home-user-DealersDrive/848a9c63-ad81-5cc0-b3a9-85ca40f2be4d/scratchpad/pw/node_modules/playwright/index.mjs';

import * as h from './lib.mjs';

export const WEB = process.env.CERT_WEB ?? 'http://localhost:3000';
export const WEB_PROD = process.env.CERT_WEB_PROD ?? 'http://localhost:3001';
export const WEB_DOWN = process.env.CERT_WEB_DOWN ?? 'http://localhost:3002';
export const SHOTS = resolve(
  process.env.CERT_RESULTS_DIR ?? resolve(h.CERT, 'registry', 'results'),
  'screenshots',
);
mkdirSync(SHOTS, { recursive: true });

export const VIEWPORTS = {
  desktop: { width: 1440, height: 900 },
  tablet: { width: 820, height: 1180 },
  mobile: { width: 390, height: 844 },
};

let browser;
export async function launch() {
  browser ??= await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  });
  return browser;
}
export async function close() {
  await browser?.close();
  browser = undefined;
}

function tokenOf(cookie) {
  return cookie.split(';')[0].split('=')[1];
}

/** A fresh browser context; `cookie` is an actor's `dd_session=…` string. */
export async function context({ viewport = VIEWPORTS.desktop, cookie, mobile = false } = {}) {
  const b = await launch();
  const ctx = await b.newContext({
    viewport,
    ...(mobile
      ? {
          isMobile: true,
          hasTouch: true,
          deviceScaleFactor: 3,
          userAgent:
            'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Mobile Safari/537.36',
        }
      : {}),
  });
  if (cookie) {
    await ctx.addCookies([
      {
        name: 'dd_session',
        value: tokenOf(cookie),
        domain: 'localhost',
        path: '/',
        httpOnly: true,
        sameSite: 'Lax',
      },
    ]);
  }
  return ctx;
}

export async function open(ctx, path, base = WEB) {
  const page = await ctx.newPage();
  const resp = await page.goto(base + path, { waitUntil: 'networkidle' });
  return { page, status: resp?.status() ?? 0 };
}

export async function shot(page, name) {
  await page.screenshot({ path: resolve(SHOTS, `${name}.png`), fullPage: false });
  return `screenshots/${name}.png`;
}

export async function facts(page) {
  return page.evaluate(() => ({
    url: location.pathname + location.search,
    h1: document.querySelector('h1')?.textContent?.trim() ?? null,
    title: document.title,
    robots: [...document.querySelectorAll('meta[name="robots"]')].map((m) => m.content),
    canonical: document.querySelector('link[rel="canonical"]')?.href ?? null,
    ogTitle: document.querySelector('meta[property="og:title"]')?.content ?? null,
    ogImage: document.querySelector('meta[property="og:image"]')?.content ?? null,
    description: document.querySelector('meta[name="description"]')?.content ?? null,
    jsonLd: [...document.querySelectorAll('script[type="application/ld+json"]')].map((s) => {
      try {
        return JSON.parse(s.textContent);
      } catch {
        return null;
      }
    }),
    icons: [...document.querySelectorAll('link[rel~="icon"],link[rel="apple-touch-icon"]')].map(
      (l) => l.getAttribute('href'),
    ),
    overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    header: !!document.querySelector('header'),
    text: document.body.innerText.slice(0, 3000),
  }));
}

/** Customer sign-in through the real web UI (fake OTP). New numbers create an account. */
export async function uiLogin(page, { phone, name, returnTo = '/' }) {
  await page.goto(`${WEB}/login?returnTo=${encodeURIComponent(returnTo)}`, {
    waitUntil: 'networkidle',
  });
  await page.locator('input[name=phone]:visible').first().fill(phone.replace(/^\+91/, ''));
  await page.getByRole('button', { name: 'Send OTP' }).first().click();
  await page.getByLabel('Digit 1 of 6').click();
  await page.keyboard.type('123456');
  await page.getByRole('button', { name: 'Verify and sign in' }).click();
  const named = page.locator('input[name=fullName]');
  await Promise.race([
    named.waitFor({ timeout: 8000 }).catch(() => null),
    page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 8000 }).catch(() => null),
  ]);
  if (await named.isVisible().catch(() => false)) {
    await named.fill(name);
    await page.getByRole('button', { name: 'Create account' }).click();
  }
  await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 15000 });
  await page.waitForLoadState('networkidle');
}

export function freshPhone(prefix = '95') {
  return `+91${prefix}${String(Date.now()).slice(-6)}${String(Math.floor(Math.random() * 100)).padStart(2, '0')}`;
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
