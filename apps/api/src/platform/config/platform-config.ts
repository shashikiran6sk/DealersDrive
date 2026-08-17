import type { PrismaClient } from '@prisma/client';

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
  { key: 'reveal.hourlyCapPerIp', label: 'Phone reveals per hour per IP', type: 'number', value: 10 },
  { key: 'billing.gstPercent', label: 'GST percent', type: 'number', value: 18 },
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
  all(): Promise<ConfigDefinition[]>;
  set(key: string, value: unknown, updatedBy: string | null): Promise<ConfigDefinition>;
  invalidate(): void;
}

const TTL_MS = 5 * 60 * 1000;

export function createPlatformConfig(prisma: PrismaClient): PlatformConfigService {
  let cache: Map<string, ConfigDefinition> | undefined;
  let loadedAt = 0;

  async function load(): Promise<Map<string, ConfigDefinition>> {
    if (cache && Date.now() - loadedAt < TTL_MS) return cache;

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

    cache = byKey;
    loadedAt = Date.now();
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
      cache = undefined;
      return { ...existing, value: value as ConfigDefinition['value'] };
    },
    invalidate() {
      cache = undefined;
    },
  };
}
