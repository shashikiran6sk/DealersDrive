import type { PrismaClient } from '@prisma/client';

import { env } from '../../config/env.js';
import type { CachePort } from '../cache/cache.port.js';

/**
 * `PlatformConfig` read through a 5-minute in-process cache (§18 layer L3).
 *
 * The numbers here are the ones that drift between files if they live in code:
 * the photo minimum appears in the submit guard, the Zod schema, the advisory
 * flag and the wizard's copy, and "6 in three places and 5 in the fourth"
 * produces a submit button that fails with no visible reason (§10).
 */
export interface ConfigDefinition {
  key: string;
  label: string;
  type: 'number' | 'boolean' | 'string' | 'string[]';
  value: number | boolean | string | string[];
}

export const CONFIG_DEFAULTS: ConfigDefinition[] = [
  { key: 'listing.durationDays', label: 'Listing duration (days)', type: 'number', value: 90 },
  { key: 'listing.minPhotos', label: 'Minimum photos per listing', type: 'number', value: 6 },
  { key: 'listing.reviewSlaHours', label: 'Review SLA (hours)', type: 'number', value: 24 },
  { key: 'photoRequests.enabled', label: 'Photo requests enabled', type: 'boolean', value: false },
  {
    key: 'photoRequests.weeklyCapPerDealer',
    label: 'Photo requests per dealer per week',
    type: 'number',
    value: 2,
  },
  { key: 'otp.maxAttempts', label: 'OTP attempts allowed', type: 'number', value: 3 },
  { key: 'otp.resendCooldownSeconds', label: 'OTP resend cooldown (s)', type: 'number', value: 60 },
  { key: 'enquiry.rateLimitPerHour', label: 'Enquiries per hour per IP', type: 'number', value: 5 },
  { key: 'reveal.dailyCapPerIp', label: 'Phone reveals per day per IP', type: 'number', value: 20 },
  {
    key: 'reveal.hourlyCapPerIp',
    label: 'Phone reveals per hour per IP',
    type: 'number',
    value: 10,
  },
  { key: 'billing.gstPercent', label: 'GST percent', type: 'number', value: 18 },

  // ── RC lookup and the vehicle report ─────────────────────────────────────
  //
  // Two knobs here are spend controls and one is a privacy decision. The
  // privacy one is `report.publicDetail`: OFF publishes aggregates and offence
  // types, ON publishes the itemised challan list. It is config rather than
  // code because it is a product judgement that may be revisited after seeing
  // the summary in production — but flipping it widens what every public
  // listing page discloses, so it is deliberately not a rendering choice a
  // component can make (ARCHITECTURE §6.1).
  { key: 'rcLookup.cacheDays', label: 'RC spec cache (days)', type: 'number', value: 30 },
  {
    key: 'rcLookup.missCacheMinutes',
    label: 'RC not-found cache (min)',
    type: 'number',
    value: 60,
  },
  {
    key: 'rcLookup.dailyCapPerDealer',
    label: 'RC lookups per dealer per day',
    type: 'number',
    value: 60,
  },
  { key: 'report.freshnessHours', label: 'Report freshness (hours)', type: 'number', value: 24 },
  {
    key: 'report.publicDetail',
    label: 'Show itemised challans to buyers',
    type: 'boolean',
    value: false,
  },

  // ── feature flags ────────────────────────────────────────────────────────
  //
  // Flags are platform config, not a second system. They get the same admin
  // screen, the same audit trail and the same cache — the only thing that makes
  // them a flag rather than a setting is the `feature.` prefix and the fact
  // that flipping one is expected to be an operational act rather than a
  // configuration change (§30).
  //
  // Every flag here must be safe in BOTH positions at all times: the rollback
  // for a bad release is flipping it back, and that has to work without a
  // deploy, a migration or a data repair.
  { key: 'feature.savedSearches', label: 'Saved searches', type: 'boolean', value: false },
  /**
   * Off: `/dealer/vehicles/new` opens on today's seven-dropdown Basics form.
   * On: it opens on the registration field, with the manual form one click
   * away. Both positions are complete flows, which is what makes this a safe
   * rollback rather than a half-disabled feature.
   */
  {
    key: 'feature.rcLookup',
    label: 'Add a vehicle by number plate',
    type: 'boolean',
    value: false,
  },
  /**
   * Independent of `feature.rcLookup` on purpose. If a wording problem
   * surfaces on the public report, this pulls it from every buyer-facing page
   * without touching intake — which is the rollback you actually want at 9pm.
   */
  {
    key: 'feature.vehicleReport',
    label: 'Vehicle records report',
    type: 'boolean',
    value: false,
  },
  { key: 'feature.dealerAnalytics', label: 'Dealer analytics tab', type: 'boolean', value: false },
  {
    key: 'feature.similarCars',
    label: 'Similar cars on the detail page',
    type: 'boolean',
    value: true,
  },
  {
    key: 'feature.enquiryAutoReply',
    label: 'Automatic enquiry acknowledgement',
    type: 'boolean',
    value: false,
  },

  {
    key: 'listing.rejectionReasonPresets',
    label: 'Rejection reason presets',
    type: 'string[]',
    value: [
      'Photos are too few or too poor to represent the vehicle.',
      'Odometer photo does not match the declared KM reading.',
      'Price is implausible for this model, year and condition.',
      'Description contains a phone number or an external link.',
      'Registration details do not match the RC book.',
    ],
  },
];

export interface PlatformConfigService {
  number(key: string): Promise<number>;
  boolean(key: string): Promise<boolean>;
  stringList(key: string): Promise<string[]>;
  /**
   * A `feature.*` flag. Distinct from `boolean()` only in that it refuses a key
   * that is not a flag, so a typo reads as a mistake rather than as `false`.
   */
  flag(key: string): Promise<boolean>;
  /** Every flag at once, for the dealer/admin bootstrap payload. */
  flags(): Promise<Record<string, boolean>>;
  all(): Promise<ConfigDefinition[]>;
  set(key: string, value: unknown, updatedBy: string | null): Promise<ConfigDefinition>;
  /** Drops this process's copy *and* signals every other task to do the same. */
  invalidate(): Promise<void>;
}

/** The prefix that makes a setting a flag. */
export const FEATURE_PREFIX = 'feature.';

/**
 * How long a task will serve its own copy before re-reading the table.
 *
 * This is the *outer* bound, and it used to be the only one: an admin turning a
 * flag off waited up to five minutes for every task to notice. The version poll
 * below is what makes the usual case seconds instead (§30).
 */
const TTL_MS = 5 * 60 * 1000;

/** The `CachePort` namespace under which the config version is bumped. */
const VERSION_NAMESPACE = 'platform-config';

/**
 * @param cache Shared state, used only to agree with other tasks about *when*
 *              the table last changed. The config values themselves are never
 *              stored there — the table is the record, and a cache that could
 *              disagree with it would be a second source of truth.
 */
export function createPlatformConfig(
  prisma: PrismaClient,
  cache: CachePort,
): PlatformConfigService {
  let entries: Map<string, ConfigDefinition> | undefined;
  let loadedAt = 0;
  /** The shared version this process's copy was built against. */
  let loadedVersion = 0;
  /** When we last asked the cache for the shared version. */
  let versionCheckedAt = 0;

  /**
   * True when another task has written since our copy was built.
   *
   * Deliberately fail-open: if the shared version cannot be read, we keep
   * serving the copy we have and fall back to the TTL. A cache blip must not
   * turn every config read into a table scan.
   */
  async function isStale(now: number): Promise<boolean> {
    if (now - versionCheckedAt < env.CONFIG_VERSION_POLL_MS) return false;
    versionCheckedAt = now;
    try {
      const current = await cache.readVersion(VERSION_NAMESPACE);
      return current !== loadedVersion;
    } catch {
      return false;
    }
  }

  async function load(): Promise<Map<string, ConfigDefinition>> {
    const now = Date.now();
    if (entries && now - loadedAt < TTL_MS && !(await isStale(now))) return entries;

    try {
      loadedVersion = await cache.readVersion(VERSION_NAMESPACE);
    } catch {
      // Leave loadedVersion alone; the TTL is still a correct fallback.
    }

    const rows = await prisma.platformConfig.findMany();
    const byKey = new Map<string, ConfigDefinition>();

    for (const fallback of CONFIG_DEFAULTS) {
      byKey.set(fallback.key, { ...fallback });
    }
    for (const row of rows) {
      const defaults = byKey.get(row.key);
      byKey.set(row.key, {
        key: row.key,
        label: row.label ?? defaults?.label ?? row.key,
        type: (row.valueType as ConfigDefinition['type']) ?? defaults?.type ?? 'string',
        value: row.value as ConfigDefinition['value'],
      });
    }

    entries = byKey;
    loadedAt = Date.now();
    versionCheckedAt = loadedAt;
    return byKey;
  }

  async function read(key: string): Promise<ConfigDefinition> {
    const byKey = await load();
    const entry = byKey.get(key);
    if (!entry) throw new Error(`Unknown platform config key: ${key}`);
    return entry;
  }

  return {
    async number(key) {
      const entry = await read(key);
      return typeof entry.value === 'number' ? entry.value : Number(entry.value);
    },
    async boolean(key) {
      const entry = await read(key);
      return Boolean(entry.value);
    },
    async stringList(key) {
      const entry = await read(key);
      return Array.isArray(entry.value) ? entry.value : [];
    },
    async flag(key) {
      if (!key.startsWith(FEATURE_PREFIX)) {
        throw new Error(`flag() takes a \`${FEATURE_PREFIX}\` key; got: ${key}`);
      }
      const entry = await read(key);
      return Boolean(entry.value);
    },
    async flags() {
      const byKey = await load();
      const result: Record<string, boolean> = {};
      for (const entry of byKey.values()) {
        if (entry.key.startsWith(FEATURE_PREFIX)) {
          result[entry.key.slice(FEATURE_PREFIX.length)] = Boolean(entry.value);
        }
      }
      return result;
    },
    async all() {
      const byKey = await load();
      return [...byKey.values()].sort((a, b) => a.key.localeCompare(b.key));
    },
    async set(key, value, updatedBy) {
      const existing = await read(key);
      await prisma.platformConfig.upsert({
        where: { key },
        create: {
          key,
          value: value as object,
          label: existing.label,
          valueType: existing.type,
          updatedBy,
        },
        update: { value: value as object, updatedBy },
      });
      entries = undefined;
      // Signal the other tasks. A failure here is not a failed write — the row
      // is committed, and every task still converges within the TTL — so it
      // must not turn a successful save into an error for the admin.
      try {
        loadedVersion = await cache.bumpVersion(VERSION_NAMESPACE);
      } catch {
        loadedVersion = 0;
      }
      return { ...existing, value: value as ConfigDefinition['value'] };
    },
    async invalidate() {
      entries = undefined;
      try {
        loadedVersion = await cache.bumpVersion(VERSION_NAMESPACE);
      } catch {
        loadedVersion = 0;
      }
    },
  };
}
