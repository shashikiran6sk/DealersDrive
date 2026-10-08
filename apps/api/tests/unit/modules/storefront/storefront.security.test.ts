import { createHmac } from 'node:crypto';

import type { Request } from 'express';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { Tx } from '../../../../src/platform/db/prisma.js';
import {
  assertStorefrontEnabled,
  lockStorefrontOrigin,
  readStorefrontIntent,
  safeEqual,
  signStorefrontIntent,
  trustedStorefrontHostname,
  type StorefrontEnvironment,
} from '../../../../src/modules/storefront/storefront.security.js';

const config: StorefrontEnvironment = {
  STOREFRONT_ENABLED: true,
  STOREFRONT_SERVICE_SECRET: 'unit-storefront-service-secret-32-characters',
  STOREFRONT_ROOT_HOSTNAME: 'dealers-drive.com',
  STOREFRONT_DEFAULT_DOMAIN_READY: true,
  WEB_BASE_URL: 'https://dealers-drive.com',
};
const host = 'alpha.dealers-drive.com';
function req(headers: Record<string, string>) {
  return { get: (key: string) => headers[key] } as unknown as Request;
}
function signed(value: unknown) {
  const body = Buffer.from(typeof value === 'string' ? value : JSON.stringify(value)).toString(
    'base64url',
  );
  return `${body}.${createHmac('sha256', config.STOREFRONT_SERVICE_SECRET!).update(`storefront-enquiry-v1:${body}`).digest('base64url')}`;
}
afterEach(() => {
  vi.useRealTimers();
});

describe('trusted host assertions', () => {
  it('fails closed when disabled or missing credentials', () => {
    expect(() => assertStorefrontEnabled({ ...config, STOREFRONT_ENABLED: false })).toThrow();
    expect(() => trustedStorefrontHostname(req({ 'x-forwarded-host': host }), config)).toThrow();
    expect(() =>
      trustedStorefrontHostname(
        req({ 'x-dd-storefront-host': host, 'x-dd-storefront-secret': 'wrong' }),
        config,
      ),
    ).toThrow();
    expect(() =>
      trustedStorefrontHostname(req({ 'x-dd-storefront-host': host }), {
        ...config,
        STOREFRONT_SERVICE_SECRET: undefined,
      }),
    ).toThrow();
  });
  it('normalizes only the service-authenticated header, ignoring forwarded-host', () => {
    expect(
      trustedStorefrontHostname(
        req({
          'x-dd-storefront-host': host.toUpperCase(),
          'x-dd-storefront-secret': config.STOREFRONT_SERVICE_SECRET!,
          'x-forwarded-host': 'beta.dealers-drive.com',
        }),
        config,
      ),
    ).toBe(host);
    expect(safeEqual('abc', 'abc')).toBe(true);
    expect(safeEqual('abc', 'abd')).toBe(false);
    expect(safeEqual('a', 'long')).toBe(false);
  });
});

describe('signed enquiry intents', () => {
  it('binds hostname and car and expires after thirty minutes', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-08T00:00:00Z'));
    const ticket = signStorefrontIntent(host, 'honda-city', config);
    expect(readStorefrontIntent(ticket, config)).toMatchObject({
      hostname: host,
      listingSlug: 'honda-city',
    });
    vi.advanceTimersByTime(30 * 60_000);
    expect(() => readStorefrontIntent(ticket, config)).toThrow();
  });
  it('rejects missing secret, malformed JSON, altered claims, extra fields and future expiry', () => {
    expect(() =>
      signStorefrontIntent(host, 'car', { ...config, STOREFRONT_SERVICE_SECRET: undefined }),
    ).toThrow();
    const ticket = signStorefrontIntent(host, 'car', config);
    for (const value of [
      '',
      'no-dot',
      ticket + '.extra',
      ticket.slice(0, -3) + 'xxx',
      'a'.repeat(1501),
      signed('not JSON'),
      signed({
        hostname: host,
        listingSlug: 'car',
        expiresAt: Date.now() + 1000,
        dealerId: 'evil',
      }),
      signed({ hostname: 'http://evil.com', listingSlug: 'car', expiresAt: Date.now() + 1000 }),
      signed({ hostname: host, listingSlug: 'car', expiresAt: Date.now() + 31 * 60_000 }),
    ]) {
      expect(() => readStorefrontIntent(value, config)).toThrow();
    }
    expect(() =>
      readStorefrontIntent(ticket, { ...config, STOREFRONT_SERVICE_SECRET: undefined }),
    ).toThrow();
    expect(() => readStorefrontIntent(ticket, { ...config, STOREFRONT_ENABLED: false })).toThrow();
  });
});

describe('submission-time authoritative state locks', () => {
  it('locks dealer, website and domain before testing eligibility', async () => {
    const query = vi.fn(async () => []);
    const count = vi.fn(async () => 1);
    const tx = { $queryRaw: query, storefrontDomain: { count } } as unknown as Tx;
    await lockStorefrontOrigin(tx, { hostname: host, storefrontId: 'site', dealerId: 'dealer' });
    expect(query).toHaveBeenCalledTimes(3);
    expect(count).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ hostname: host, status: 'ACTIVE' }),
      }),
    );
    count.mockResolvedValue(0);
    await expect(
      lockStorefrontOrigin(tx, { hostname: host, storefrontId: 'site', dealerId: 'dealer' }),
    ).rejects.toMatchObject({ status: 404 });
  });
});
