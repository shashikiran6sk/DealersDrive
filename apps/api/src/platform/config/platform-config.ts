import type { PrismaClient } from '@prisma/client';

import { env } from '../../config/env.js';
import type { CachePort } from '../cache/cache.port.js';

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

  { key: 'feature.savedSearches', label: 'Saved searches', type: 'boolean', value: false },
  {
    key: 'feature.rcLookup',
    label: 'Add a vehicle by number plate',
    type: 'boolean',
    value: false,
  },
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

  { key: 'social.instagram', label: 'Instagram URL', type: 'string', value: '' },
  { key: 'social.facebook', label: 'Facebook URL', type: 'string', value: '' },
  { key: 'social.youtube', label: 'YouTube URL', type: 'string', value: '' },
  { key: 'social.linkedin', label: 'LinkedIn URL', type: 'string', value: '' },
  { key: 'social.x', label: 'X (Twitter) URL', type: 'string', value: '' },
  { key: 'social.whatsapp', label: 'WhatsApp URL', type: 'string', value: '' },

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

export const CONFIG_READERS: Record<string, string> = {
  'billing.gstPercent': "the admin console's revenue figure",
  'listing.minPhotos': 'GET /v1/config/public',
  'listing.durationDays': 'GET /v1/config/public',
  'enquiry.rateLimitPerHour': 'GET /v1/config/public',
  'photoRequests.enabled': 'GET /v1/config/public',
  'feature.rcLookup': 'GET /v1/config/public',
  'feature.vehicleReport': 'GET /v1/config/public',
  'social.instagram': "GET /v1/config/public — the public footer's social row",
  'social.facebook': "GET /v1/config/public — the public footer's social row",
  'social.youtube': "GET /v1/config/public — the public footer's social row",
  'social.linkedin': "GET /v1/config/public — the public footer's social row",
  'social.x': "GET /v1/config/public — the public footer's social row",
  'social.whatsapp': "GET /v1/config/public — the public footer's social row",
};

export interface PlatformConfigService {
  number(key: string): Promise<number>;
  boolean(key: string): Promise<boolean>;
  string(key: string): Promise<string>;
  stringList(key: string): Promise<string[]>;
  flag(key: string): Promise<boolean>;
  flags(): Promise<Record<string, boolean>>;
  all(): Promise<ConfigDefinition[]>;
  set(key: string, value: unknown, updatedBy: string | null): Promise<ConfigDefinition>;
  invalidate(): Promise<void>;
}

export const FEATURE_PREFIX = 'feature.';

const TTL_MS = 5 * 60 * 1000;

const VERSION_NAMESPACE = 'platform-config';

export function createPlatformConfig(
  prisma: PrismaClient,
  cache: CachePort,
): PlatformConfigService {
  let entries: Map<string, ConfigDefinition> | undefined;
  let loadedAt = 0;
  let loadedVersion = 0;
  let versionCheckedAt = 0;

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

    loadedVersion = await cache.readVersion(VERSION_NAMESPACE).catch(() => loadedVersion);

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
    async string(key) {
      const entry = await read(key);
      return typeof entry.value === 'string' ? entry.value.trim() : '';
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
