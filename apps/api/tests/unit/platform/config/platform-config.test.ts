import type { PrismaClient } from '@prisma/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createMemoryCache } from '../../../../src/platform/cache/memory.adapter.js';
import {
  CONFIG_DEFAULTS,
  createPlatformConfig,
  FEATURE_PREFIX,
} from '../../../../src/platform/config/platform-config.js';

/**
 * Unit tests for `src/platform/config/platform-config.ts`.
 *
 * The reason this module exists is in its own docblock: the photo minimum appears
 * in the submit guard, the Zod schema, the advisory flag and the wizard's copy,
 * and "6 in three places and 5 in the fourth" produces a submit button that fails
 * with no visible reason. So the tests here are about the two ways that can still
 * happen — a stale cache, and a row that overrides a default badly.
 */
interface Row {
  key: string;
  label: string | null;
  valueType: string | null;
  value: unknown;
}

function fakes(rows: Row[] = []) {
  let queries = 0;
  const upserts: { where: { key: string }; create: unknown; update: unknown }[] = [];

  const prisma = {
    platformConfig: {
      findMany: () => {
        queries += 1;
        return Promise.resolve(rows);
      },
      upsert: (args: { where: { key: string }; create: unknown; update: unknown }) => {
        upserts.push(args);
        return Promise.resolve({});
      },
    },
  } as unknown as PrismaClient;

  return {
    prisma,
    upserts,
    get queries() {
      return queries;
    },
    setRows(next: Row[]) {
      rows = next;
    },
  };
}

describe('CONFIG_DEFAULTS', () => {
  it('has no duplicate keys', () => {
    const keys = CONFIG_DEFAULTS.map((entry) => entry.key);

    expect(new Set(keys).size).toBe(keys.length);
  });

  it('declares a value whose runtime type matches its declared type', () => {
    for (const entry of CONFIG_DEFAULTS) {
      const actual = Array.isArray(entry.value) ? 'string[]' : typeof entry.value;
      expect(actual, `${entry.key} is declared ${entry.type}`).toBe(entry.type);
    }
  });

  it('gives every key a human label for the admin screen', () => {
    for (const entry of CONFIG_DEFAULTS) {
      expect(entry.label.length, `${entry.key} needs a label`).toBeGreaterThan(0);
      expect(entry.label).not.toBe(entry.key);
    }
  });

  it('keeps the caps that cost money strictly positive', () => {
    const caps = [
      'enquiry.rateLimitPerHour',
      'reveal.dailyCapPerIp',
      'reveal.hourlyCapPerIp',
      'otp.maxAttempts',
    ];

    for (const key of caps) {
      const entry = CONFIG_DEFAULTS.find((candidate) => candidate.key === key);
      expect(entry, `${key} should exist`).toBeDefined();
      // A cap of 0 would silently disable the feature rather than limit it.
      expect(Number(entry?.value), `${key} must be > 0`).toBeGreaterThan(0);
    }
  });

  it('keeps the hourly reveal cap at or below the daily one', () => {
    const hourly = Number(
      CONFIG_DEFAULTS.find((entry) => entry.key === 'reveal.hourlyCapPerIp')?.value,
    );
    const daily = Number(
      CONFIG_DEFAULTS.find((entry) => entry.key === 'reveal.dailyCapPerIp')?.value,
    );

    expect(hourly).toBeLessThanOrEqual(daily);
  });

  it('ships rejection presets that a moderator can send as-is', () => {
    const presets = CONFIG_DEFAULTS.find((entry) => entry.key === 'listing.rejectionReasonPresets')
      ?.value as string[];

    expect(presets.length).toBeGreaterThan(3);
    for (const preset of presets) {
      // They are shown to the dealer verbatim, so each has to be a full sentence.
      expect(preset).toMatch(/^[A-Z].*\.$/);
    }
  });
});

describe('reading a value', () => {
  it('falls back to the shipped default when the table is empty', async () => {
    const config = createPlatformConfig(fakes().prisma, createMemoryCache());

    expect(await config.number('listing.minPhotos')).toBe(6);
    expect(await config.number('billing.gstPercent')).toBe(18);
    expect(await config.boolean('photoRequests.enabled')).toBe(false);
  });

  it('prefers the stored row over the default', async () => {
    const config = createPlatformConfig(
      fakes([{ key: 'listing.minPhotos', label: null, valueType: 'number', value: 8 }]).prisma,
      createMemoryCache(),
    );

    expect(await config.number('listing.minPhotos')).toBe(8);
  });

  it('coerces a stored value that arrived as a string', async () => {
    // jsonb round trips do not always preserve the number type, and a
    // `"8" < 6` comparison is false in a way nobody notices until submit breaks.
    const config = createPlatformConfig(
      fakes([{ key: 'listing.minPhotos', label: null, valueType: 'number', value: '8' }]).prisma,
      createMemoryCache(),
    );

    expect(await config.number('listing.minPhotos')).toBe(8);
    expect(typeof (await config.number('listing.minPhotos'))).toBe('number');
  });

  it('reads booleans by truthiness, so a stored 1 or "true" still works', async () => {
    for (const stored of [true, 1, 'true', 'false']) {
      const config = createPlatformConfig(
        fakes([{ key: 'photoRequests.enabled', label: null, valueType: 'boolean', value: stored }])
          .prisma,
        createMemoryCache(),
      );
      expect(await config.boolean('photoRequests.enabled'), `stored ${String(stored)}`).toBe(true);
    }

    for (const stored of [false, 0, '']) {
      const config = createPlatformConfig(
        fakes([{ key: 'photoRequests.enabled', label: null, valueType: 'boolean', value: stored }])
          .prisma,
        createMemoryCache(),
      );
      expect(await config.boolean('photoRequests.enabled'), `stored ${String(stored)}`).toBe(false);
    }
  });

  it('returns an empty list rather than throwing when a list value is malformed', async () => {
    const config = createPlatformConfig(
      fakes([
        {
          key: 'listing.rejectionReasonPresets',
          label: null,
          valueType: 'string[]',
          value: 'not a list',
        },
      ]).prisma,
      createMemoryCache(),
    );

    // The moderation screen renders these as buttons; an empty list is a screen
    // with no presets, which is survivable. A throw is a 500 on the queue.
    expect(await config.stringList('listing.rejectionReasonPresets')).toEqual([]);
  });

  it('throws on an unknown key, because that is a programming error', async () => {
    const config = createPlatformConfig(fakes().prisma, createMemoryCache());

    await expect(config.number('listing.doesNotExist')).rejects.toThrow(
      /Unknown platform config key: listing\.doesNotExist/,
    );
  });

  it('keeps a row that has no matching default', async () => {
    const config = createPlatformConfig(
      fakes([{ key: 'experimental.flag', label: 'Experiment', valueType: 'boolean', value: true }])
        .prisma,
      createMemoryCache(),
    );

    expect(await config.boolean('experimental.flag')).toBe(true);
  });

  it('borrows the label and type from the default when the row omits them', async () => {
    const config = createPlatformConfig(
      fakes([{ key: 'listing.minPhotos', label: null, valueType: null, value: 7 }]).prisma,
      createMemoryCache(),
    );
    const all = await config.all();
    const entry = all.find((candidate) => candidate.key === 'listing.minPhotos');

    expect(entry?.label).toBe('Minimum photos per listing');
    expect(entry?.type).toBe('number');
  });

  it('falls back to the key as a label for an unknown row with no label', async () => {
    const config = createPlatformConfig(
      fakes([{ key: 'mystery.key', label: null, valueType: null, value: 'x' }]).prisma,
      createMemoryCache(),
    );
    const entry = (await config.all()).find((candidate) => candidate.key === 'mystery.key');

    expect(entry?.label).toBe('mystery.key');
    expect(entry?.type).toBe('string');
  });
});

describe('all', () => {
  it('returns every key, defaults included, sorted for a stable admin screen', async () => {
    const config = createPlatformConfig(fakes().prisma, createMemoryCache());

    const all = await config.all();

    expect(all).toHaveLength(CONFIG_DEFAULTS.length);
    expect(all.map((entry) => entry.key)).toEqual(
      [...all.map((entry) => entry.key)].sort((a, b) => a.localeCompare(b)),
    );
  });

  it('returns copies, so a caller cannot mutate the shipped defaults', async () => {
    const config = createPlatformConfig(fakes().prisma, createMemoryCache());

    const [entry] = await config.all();
    if (entry) entry.value = 999;

    const definition = CONFIG_DEFAULTS.find((candidate) => candidate.key === entry?.key);
    expect(definition?.value).not.toBe(999);
  });
});

describe('the five-minute cache', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('queries once for many reads', async () => {
    const fake = fakes();
    const config = createPlatformConfig(fake.prisma, createMemoryCache());

    await config.number('listing.minPhotos');
    await config.number('billing.gstPercent');
    await config.boolean('photoRequests.enabled');

    expect(fake.queries).toBe(1);
  });

  it('re-reads after the TTL expires', async () => {
    const fake = fakes();
    const config = createPlatformConfig(fake.prisma, createMemoryCache());

    await config.number('listing.minPhotos');
    vi.advanceTimersByTime(5 * 60 * 1000 + 1);
    await config.number('listing.minPhotos');

    expect(fake.queries).toBe(2);
  });

  it('still serves from cache just before the TTL', async () => {
    const fake = fakes();
    const config = createPlatformConfig(fake.prisma, createMemoryCache());

    await config.number('listing.minPhotos');
    vi.advanceTimersByTime(5 * 60 * 1000 - 1);
    await config.number('listing.minPhotos');

    expect(fake.queries).toBe(1);
  });

  it('serves a stale value until the TTL, which is the accepted trade', async () => {
    const fake = fakes([{ key: 'listing.minPhotos', label: null, valueType: 'number', value: 6 }]);
    const config = createPlatformConfig(fake.prisma, createMemoryCache());

    await config.number('listing.minPhotos');
    fake.setRows([{ key: 'listing.minPhotos', label: null, valueType: 'number', value: 9 }]);

    expect(await config.number('listing.minPhotos')).toBe(6);
    vi.advanceTimersByTime(5 * 60 * 1000 + 1);
    expect(await config.number('listing.minPhotos')).toBe(9);
  });

  it('drops the cache on invalidate', async () => {
    const fake = fakes([{ key: 'listing.minPhotos', label: null, valueType: 'number', value: 6 }]);
    const config = createPlatformConfig(fake.prisma, createMemoryCache());

    await config.number('listing.minPhotos');
    fake.setRows([{ key: 'listing.minPhotos', label: null, valueType: 'number', value: 9 }]);
    await config.invalidate();

    expect(await config.number('listing.minPhotos')).toBe(9);
    expect(fake.queries).toBe(2);
  });

  it('caches per service instance, not globally', async () => {
    const first = fakes();
    const second = fakes();

    await createPlatformConfig(first.prisma, createMemoryCache()).number('listing.minPhotos');
    await createPlatformConfig(second.prisma, createMemoryCache()).number('listing.minPhotos');

    expect(first.queries).toBe(1);
    expect(second.queries).toBe(1);
  });
});

describe('set', () => {
  it('upserts the value and records who changed it', async () => {
    const fake = fakes();
    const config = createPlatformConfig(fake.prisma, createMemoryCache());

    await config.set('listing.minPhotos', 8, 'admin-1');

    expect(fake.upserts).toHaveLength(1);
    expect(fake.upserts[0]?.where).toEqual({ key: 'listing.minPhotos' });
    expect(fake.upserts[0]?.update).toEqual({ value: 8, updatedBy: 'admin-1' });
  });

  it('carries the label and type into the row it creates', async () => {
    const fake = fakes();
    const config = createPlatformConfig(fake.prisma, createMemoryCache());

    await config.set('listing.minPhotos', 8, 'admin-1');

    // The row is the source of truth once written, so it has to carry enough to
    // render the admin screen without the code defaults.
    expect(fake.upserts[0]?.create).toMatchObject({
      key: 'listing.minPhotos',
      label: 'Minimum photos per listing',
      valueType: 'number',
      updatedBy: 'admin-1',
    });
  });

  it('accepts a null author for a system change', async () => {
    const fake = fakes();

    await createPlatformConfig(fake.prisma, createMemoryCache()).set('listing.minPhotos', 8, null);

    expect(fake.upserts[0]?.update).toMatchObject({ updatedBy: null });
  });

  it('returns the new definition', async () => {
    const config = createPlatformConfig(fakes().prisma, createMemoryCache());

    const updated = await config.set('listing.minPhotos', 8, 'admin-1');

    expect(updated).toEqual({
      key: 'listing.minPhotos',
      label: 'Minimum photos per listing',
      type: 'number',
      value: 8,
    });
  });

  it('invalidates the cache, so the next read is the value just written', async () => {
    const fake = fakes([{ key: 'listing.minPhotos', label: null, valueType: 'number', value: 6 }]);
    const config = createPlatformConfig(fake.prisma, createMemoryCache());

    await config.number('listing.minPhotos');
    fake.setRows([{ key: 'listing.minPhotos', label: null, valueType: 'number', value: 8 }]);
    await config.set('listing.minPhotos', 8, 'admin-1');

    // Without this, an admin changes the photo minimum and watches nothing happen
    // for five minutes.
    expect(await config.number('listing.minPhotos')).toBe(8);
  });

  it('refuses to write an unknown key', async () => {
    const fake = fakes();

    await expect(
      createPlatformConfig(fake.prisma, createMemoryCache()).set('listing.nonsense', 1, 'admin-1'),
    ).rejects.toThrow(/Unknown platform config key/);
    expect(fake.upserts).toEqual([]);
  });
});

describe('feature flags', () => {
  /**
   * Flags are platform config, not a second system — same table, same admin
   * screen, same audit trail. The `feature.` prefix is the whole distinction,
   * so it is the thing worth pinning down (§30).
   */
  it('ships every flag as a boolean, defaulting to a safe position', () => {
    const flags = CONFIG_DEFAULTS.filter((entry) => entry.key.startsWith(FEATURE_PREFIX));

    expect(flags.length).toBeGreaterThan(0);
    for (const flag of flags) {
      expect(flag.type).toBe('boolean');
      expect(typeof flag.value).toBe('boolean');
      // Every flag has to be readable in an admin list without decoding a key.
      expect(flag.label.length).toBeGreaterThan(3);
    }
  });

  it('reads a flag off the stored row', async () => {
    const config = createPlatformConfig(
      fakes([{ key: 'feature.savedSearches', label: null, valueType: 'boolean', value: true }])
        .prisma,
      createMemoryCache(),
    );

    expect(await config.flag('feature.savedSearches')).toBe(true);
  });

  /**
   * A typo has to read as a mistake. `boolean('feature.saveSearches')` would
   * throw "unknown key", but a caller reaching for a flag deserves to be told
   * it is not a flag rather than that it does not exist.
   */
  it('refuses a key that is not a flag', async () => {
    const config = createPlatformConfig(fakes().prisma, createMemoryCache());

    await expect(config.flag('listing.minPhotos')).rejects.toThrow(/takes a `feature\.` key/);
  });

  it('lists every flag at once, unprefixed, for the bootstrap payload', async () => {
    const config = createPlatformConfig(
      fakes([{ key: 'feature.savedSearches', label: null, valueType: 'boolean', value: true }])
        .prisma,
      createMemoryCache(),
    );

    const flags = await config.flags();

    expect(flags.savedSearches).toBe(true);
    expect(flags['listing.minPhotos']).toBeUndefined();
    for (const key of Object.keys(flags)) {
      expect(key.startsWith(FEATURE_PREFIX)).toBe(false);
    }
  });
});

describe('cross-instance invalidation', () => {
  // The poll interval is a clock, so these drive it rather than sleeping.
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  /**
   * The reason this exists: with N tasks, the writer drops *its* cache and the
   * other N-1 keep serving the old value until their five-minute TTL expires.
   * A shared version counter is what turns "up to five minutes" into "up to
   * one poll interval" (§18, §30).
   */
  it('re-reads when another instance has written', async () => {
    const cache = createMemoryCache();
    const writerRows = [{ key: 'listing.minPhotos', label: null, valueType: 'number', value: 6 }];
    const writer = fakes(writerRows);
    const reader = fakes(writerRows);

    const a = createPlatformConfig(writer.prisma, cache);
    const b = createPlatformConfig(reader.prisma, cache);

    expect(await b.number('listing.minPhotos')).toBe(6);
    expect(reader.queries).toBe(1);

    // The other task writes. Both fakes move, because they stand for one table.
    writer.setRows([{ key: 'listing.minPhotos', label: null, valueType: 'number', value: 9 }]);
    reader.setRows([{ key: 'listing.minPhotos', label: null, valueType: 'number', value: 9 }]);
    await a.set('listing.minPhotos', 9, 'admin-1');

    // The poll interval has to pass before this instance asks again.
    vi.advanceTimersByTime(11_000);

    expect(await b.number('listing.minPhotos')).toBe(9);
    expect(reader.queries).toBe(2);
  });

  it('does not re-read within the poll interval', async () => {
    const cache = createMemoryCache();
    const fake = fakes();
    const config = createPlatformConfig(fake.prisma, cache);

    await config.number('listing.minPhotos');
    await cache.bumpVersion('platform-config');
    vi.advanceTimersByTime(1_000);
    await config.number('listing.minPhotos');

    // One poll per interval, not one per read — otherwise every config lookup
    // becomes a network round trip.
    expect(fake.queries).toBe(1);
  });

  /**
   * Fail-open, deliberately. If the shared version cannot be read we keep
   * serving the copy we have and fall back to the TTL — a cache blip must not
   * turn every config read into a table scan.
   */
  it('keeps serving its cached copy when the version cannot be read', async () => {
    const broken = {
      ...createMemoryCache(),
      readVersion: () => Promise.reject(new Error('down')),
    };
    const fake = fakes();
    const config = createPlatformConfig(fake.prisma, broken);

    await config.number('listing.minPhotos');
    vi.advanceTimersByTime(11_000);

    expect(await config.number('listing.minPhotos')).toBe(6);
    expect(fake.queries).toBe(1);
  });

  it('still saves when the version bump fails', async () => {
    const broken = {
      ...createMemoryCache(),
      bumpVersion: () => Promise.reject(new Error('down')),
    };
    const fake = fakes();

    // The row is committed before the signal is sent, so a failed signal must
    // not surface to the admin as a failed save.
    await expect(
      createPlatformConfig(fake.prisma, broken).set('listing.minPhotos', 8, 'admin-1'),
    ).resolves.toMatchObject({ value: 8 });
    expect(fake.upserts).toHaveLength(1);
  });
});
