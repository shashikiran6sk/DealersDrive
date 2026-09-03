import { describe, expect, it } from 'vitest';

import { env } from '../../../../src/config/env.js';
import { createConfigService } from '../../../../src/modules/config/config.service.js';
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
function config(values: Record<string, number | boolean> = {}): PlatformConfigService {
  return {
    number: (key: string) => Promise.resolve(Number(values[key] ?? 0)),
    boolean: (key: string) => Promise.resolve(Boolean(values[key])),
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
