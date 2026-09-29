import { describe, expect, it } from 'vitest';

import { env } from '../../../../src/config/env.js';
import {
  createConfigService,
  supportContacts,
} from '../../../../src/modules/config/config.service.js';
import type { PlatformConfigService } from '../../../../src/platform/config/platform-config.js';

/**
 * Unit tests for `src/modules/config/config.service.ts`.
 *
 * ── Adapted from `tests/unit/modules/catalog/catalog.service.test.ts` ───────
 * The baseline's `describe('publicConfig')` block, moved with the code it
 * covers. Decision D1 deletes the catalogue module; the public config payload
 * never belonged to it — it reads `PlatformConfig` and `env` and touches no
 * catalogue table. The assertions are the baseline's, with the `repo` and
 * `search` stubs dropped because this service takes neither.
 * ────────────────────────────────────────────────────────────────────────────
 */
function config(values: Record<string, number | boolean | string> = {}): PlatformConfigService {
  return {
    number: (key: string) => Promise.resolve(Number(values[key] ?? 0)),
    boolean: (key: string) => Promise.resolve(Boolean(values[key])),
    string: (key: string) => Promise.resolve(String(values[key] ?? '')),
    stringList: () => Promise.resolve([]),
    all: () => Promise.resolve([]),
    set: () => Promise.reject(new Error('not used')),
    flag: () => Promise.resolve(false),
    flags: () => Promise.resolve({}),
    invalidate: () => Promise.resolve(),
  };
}

describe('publicConfig', () => {
  it('exposes the operational numbers the web app needs', async () => {
    const service = createConfigService({
      config: config({
        'listing.minPhotos': 6,
        'listing.durationDays': 90,
        'enquiry.rateLimitPerHour': 5,
        'photoRequests.enabled': true,
      }),
    });

    expect(await service.publicConfig()).toMatchObject({
      minPhotosPerListing: 6,
      listingDurationDays: 90,
      enquiryRateLimitPerHour: 5,
      photoRequestsEnabled: true,
    });
  });

  it('reads the photo minimum from config, so the wizard and the guard agree', async () => {
    const service = createConfigService({ config: config({ 'listing.minPhotos': 8 }) });

    // The whole reason platform config exists: "6 in three places and 5 in the
    // fourth" is a submit button that fails with no visible reason.
    expect((await service.publicConfig()).minPhotosPerListing).toBe(8);
  });

  it('carries the support contacts and media origin from the environment', async () => {
    const publicConfig = await createConfigService({ config: config() }).publicConfig();

    expect(publicConfig.mediaBaseUrl).toBe(env.MEDIA_BASE_URL);
    expect(publicConfig.supportEmail).toBe(env.SUPPORT_EMAIL);
    expect(publicConfig.supportPhone).toBe(env.SUPPORT_PHONE);
  });

  it('reports no captcha site key, because there is no captcha in this build', async () => {
    // Null rather than an empty string: the client branches on it to decide
    // whether to render the widget at all.
    expect((await createConfigService({ config: config() }).publicConfig()).captchaSiteKey).toBe(
      null,
    );
  });

  it('reports photo requests off when the flag is off', async () => {
    const service = createConfigService({ config: config({ 'photoRequests.enabled': false }) });

    expect((await service.publicConfig()).photoRequestsEnabled).toBe(false);
  });

  /**
   * These two decide which intake screen opens and whether listing pages carry
   * a records check. They are read here rather than in the web app precisely so
   * that flipping one takes effect without a redeploy — `NEXT_PUBLIC_*` would
   * bake them into the image and break build-once-promote-many (Rule 9).
   */
  it('carries the two feature flags the browser branches on', async () => {
    const on = createConfigService({
      config: config({ 'feature.rcLookup': true, 'feature.vehicleReport': true }),
    });
    const off = createConfigService({ config: config() });

    expect(await on.publicConfig()).toMatchObject({
      rcLookupEnabled: true,
      vehicleReportEnabled: true,
    });
    expect(await off.publicConfig()).toMatchObject({
      rcLookupEnabled: false,
      vehicleReportEnabled: false,
    });
  });
});

/**
 * The social row (**R44**).
 *
 * These six values are typed into a text box on `/admin/config` and rendered
 * into an `href` on every public page in the product, which is exactly the
 * shape of an injected URI. The scheme is therefore checked **here**, once, on
 * the way out — so these are tests of a security boundary rather than of a
 * formatting nicety.
 */
describe('social links', () => {
  it('carries the networks that have a URL, in the order the footer draws them', async () => {
    const service = createConfigService({
      config: config({
        'social.instagram': 'https://instagram.com/dealersdrive',
        'social.youtube': 'https://youtube.com/@dealersdrive',
      }),
    });

    expect((await service.publicConfig()).social).toEqual([
      { network: 'instagram', label: 'Instagram', href: 'https://instagram.com/dealersdrive' },
      { network: 'youtube', label: 'YouTube', href: 'https://youtube.com/@dealersdrive' },
    ]);
  });

  /**
   * An empty key means "we do not publish one". It is absent rather than
   * present-and-empty so the footer renders what it is handed and has no rule
   * of its own about which links are real.
   */
  it('reports none at all on a fresh deployment', async () => {
    expect((await createConfigService({ config: config() }).publicConfig()).social).toEqual([]);
  });

  it.each([
    ['a javascript: URI', 'javascript:alert(1)'],
    ['a data: URI', 'data:text/html,<script>alert(1)</script>'],
    ['plain HTTP', 'http://instagram.com/dealersdrive'],
    ['a bare handle', '@dealersdrive'],
    ['an unparseable value', 'instagram.com/dealersdrive'],
  ])('drops %s rather than putting it in an href', async (_case, value) => {
    const service = createConfigService({ config: config({ 'social.instagram': value }) });

    expect((await service.publicConfig()).social).toEqual([]);
  });

  /** One bad value must not take the good ones with it. */
  it('keeps the valid networks when one is mistyped', async () => {
    const service = createConfigService({
      config: config({
        'social.instagram': 'javascript:alert(1)',
        'social.facebook': 'https://facebook.com/dealersdrive',
      }),
    });

    expect((await service.publicConfig()).social).toEqual([
      { network: 'facebook', label: 'Facebook', href: 'https://facebook.com/dealersdrive' },
    ]);
  });
});

/**
 * The Contact & support page's addresses. Like the social row, each value is
 * typed into `/admin/config` and rendered into an `href`, so it is checked on
 * the way out; an empty or unusable entry falls back to the deployment's own
 * support contact rather than rendering nothing or something unsafe.
 */
describe('support contacts', () => {
  it('falls back to the deployment support contact until an operator sets one', async () => {
    const { support } = await createConfigService({ config: config() }).publicConfig();

    expect(support).toEqual({
      customer: { email: env.SUPPORT_EMAIL, phone: env.SUPPORT_PHONE },
      dealer: { email: env.SUPPORT_EMAIL, phone: env.SUPPORT_PHONE },
      whatsappHref: null,
    });
  });

  it('carries the customer and dealer contacts an operator configured', async () => {
    const service = createConfigService({
      config: config({
        'support.customerEmail': 'help@example.org',
        'support.customerPhone': '+91 98400 12345',
        'support.dealerEmail': 'dealers@example.org',
        'support.dealerPhone': '044-2345-6789',
      }),
    });

    expect((await service.publicConfig()).support).toMatchObject({
      customer: { email: 'help@example.org', phone: '+91 98400 12345' },
      dealer: { email: 'dealers@example.org', phone: '044-2345-6789' },
    });
  });

  it.each([['javascript:alert(1)'], ['not an email'], ['a@b'], ['"x"@example.org']])(
    'refuses %j as an email and keeps the fallback',
    (value) => {
      expect(supportContacts([value]).customer.email).toBe(env.SUPPORT_EMAIL);
    },
  );

  it.each([['tel:+91'], ['call us'], ['12'], ['+91 98400 12345; drop']])(
    'refuses %j as a phone number and keeps the fallback',
    (value) => {
      expect(supportContacts(['', value]).customer.phone).toBe(env.SUPPORT_PHONE);
    },
  );

  it('turns a WhatsApp number into a wa.me chat link', () => {
    expect(supportContacts(['', '', '', '', '+91 98400 12345']).whatsappHref).toBe(
      'https://wa.me/919840012345',
    );
  });

  it('keeps an https chat URL and refuses any other scheme', () => {
    expect(supportContacts(['', '', '', '', 'https://wa.me/919840012345']).whatsappHref).toBe(
      'https://wa.me/919840012345',
    );
    expect(supportContacts(['', '', '', '', 'http://wa.me/919840012345']).whatsappHref).toBeNull();
    expect(supportContacts(['', '', '', '', 'javascript:alert(1)']).whatsappHref).toBeNull();
    expect(supportContacts(['', '', '', '', '']).whatsappHref).toBeNull();
  });
});
