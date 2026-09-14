import type { PublicConfig, SocialLink } from '@dealers-drive/contracts';

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
      ] = await Promise.all([
        config.number('listing.minPhotos'),
        config.number('listing.durationDays'),
        config.number('enquiry.rateLimitPerHour'),
        config.boolean('photoRequests.enabled'),
        config.boolean('feature.rcLookup'),
        config.boolean('feature.vehicleReport'),
        Promise.all(SOCIAL_NETWORKS.map((entry) => config.string(entry.key))),
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
      };
    },
  };
}

export type ConfigService = ReturnType<typeof createConfigService>;
