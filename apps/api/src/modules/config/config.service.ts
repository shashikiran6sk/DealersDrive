import type { PublicConfig, SocialLink, SupportContacts } from '@dealers-drive/contracts';

import { env } from '../../config/env.js';
import type { PlatformConfigService } from '../../platform/config/platform-config.js';

export interface ConfigDeps {
  config: PlatformConfigService;
}

const SOCIAL_NETWORKS: { key: string; network: SocialLink['network']; label: string }[] = [
  { key: 'social.instagram', network: 'instagram', label: 'Instagram' },
  { key: 'social.facebook', network: 'facebook', label: 'Facebook' },
  { key: 'social.youtube', network: 'youtube', label: 'YouTube' },
  { key: 'social.linkedin', network: 'linkedin', label: 'LinkedIn' },
  { key: 'social.x', network: 'x', label: 'X' },
  { key: 'social.whatsapp', network: 'whatsapp', label: 'WhatsApp' },
];

function socialHref(value: string): string | null {
  if (value === '') return null;
  try {
    return new URL(value).protocol === 'https:' ? value : null;
  } catch {
    return null;
  }
}

const SUPPORT_KEYS = [
  'support.customerEmail',
  'support.customerPhone',
  'support.dealerEmail',
  'support.dealerPhone',
  'support.whatsapp',
] as const;

const EMAIL_PATTERN = /^[^\s@<>()"',;:]+@[^\s@<>()"',;:]+\.[a-z]{2,}$/i;
const PHONE_PATTERN = /^\+?[0-9][0-9 -]{5,18}[0-9]$/;
const WHATSAPP_DIGITS = /^[0-9]{8,15}$/;

function supportEmail(value: string): string {
  return EMAIL_PATTERN.test(value) ? value : env.SUPPORT_EMAIL;
}

function supportPhone(value: string): string {
  return PHONE_PATTERN.test(value) ? value : env.SUPPORT_PHONE;
}

function whatsappHref(value: string): string | null {
  if (value === '') return null;
  const digits = value.replace(/[\s()+-]/g, '');
  if (WHATSAPP_DIGITS.test(digits)) return `https://wa.me/${digits}`;
  return socialHref(value);
}

export function supportContacts(values: readonly string[]): SupportContacts {
  const [customerEmail = '', customerPhone = '', dealerEmail = '', dealerPhone = '', chat = ''] =
    values;
  return {
    customer: { email: supportEmail(customerEmail), phone: supportPhone(customerPhone) },
    dealer: { email: supportEmail(dealerEmail), phone: supportPhone(dealerPhone) },
    whatsappHref: whatsappHref(chat),
  };
}

export function createConfigService({ config }: ConfigDeps) {
  return {
    async publicConfig(): Promise<PublicConfig> {
      const [
        minPhotos,
        durationDays,
        enquiryRate,
        photoRequests,
        rcLookup,
        vehicleReport,
        socialValues,
        supportValues,
      ] = await Promise.all([
        config.number('listing.minPhotos'),
        config.number('listing.durationDays'),
        config.number('enquiry.rateLimitPerHour'),
        config.boolean('photoRequests.enabled'),
        config.boolean('feature.rcLookup'),
        config.boolean('feature.vehicleReport'),
        Promise.all(SOCIAL_NETWORKS.map((entry) => config.string(entry.key))),
        Promise.all(SUPPORT_KEYS.map((key) => config.string(key))),
      ]);

      const social: SocialLink[] = [];
      for (const [index, entry] of SOCIAL_NETWORKS.entries()) {
        const href = socialHref(socialValues[index] ?? '');
        if (href !== null) social.push({ network: entry.network, label: entry.label, href });
      }

      return {
        mediaBaseUrl: env.MEDIA_BASE_URL,
        captchaSiteKey: null,
        supportEmail: env.SUPPORT_EMAIL,
        supportPhone: env.SUPPORT_PHONE,
        minPhotosPerListing: minPhotos,
        listingDurationDays: durationDays,
        enquiryRateLimitPerHour: enquiryRate,
        photoRequestsEnabled: photoRequests,
        rcLookupEnabled: rcLookup,
        vehicleReportEnabled: vehicleReport,
        social,
        support: supportContacts(supportValues),
      };
    },
  };
}

export type ConfigService = ReturnType<typeof createConfigService>;
