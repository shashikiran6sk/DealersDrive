import type { PublicConfig, SocialLink } from '@dealers-drive/contracts';

import { env } from '../../config/env.js';
import type { PlatformConfigService } from '../../platform/config/platform-config.js';

/**
 * The public bootstrap payload — everything the browser needs to know about
 * this deployment, and nothing it does not.
 *
 * ── Relocated by decision D1 ────────────────────────────────────────────────
 * In the baseline this is `publicConfig()` on `catalog.service.ts`, sharing a
 * module with the vehicle catalogue D1 removes. It never belonged there: it
 * reads `PlatformConfig` and `env`, and touches no catalogue table. The body is
 * unchanged; only its address is.
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Why the flags are read here rather than in the web app: a flag flip has to
 * take effect without a redeploy, and `NEXT_PUBLIC_*` is inlined at build time
 * (Rule 9). Reading them server-side and shipping them in this payload is what
 * keeps build-once-promote-many intact.
 */
export interface ConfigDeps {
  config: PlatformConfigService;
}

/**
 * The networks the footer can draw, in the order it draws them (**R44**).
 *
 * The order is here rather than in the component because it is one list, and a
 * second copy of it in the web app would be a second thing to keep in step —
 * the footer renders what it is handed, in the order it is handed.
 */
const SOCIAL_NETWORKS: { key: string; network: SocialLink['network']; label: string }[] = [
  { key: 'social.instagram', network: 'instagram', label: 'Instagram' },
  { key: 'social.facebook', network: 'facebook', label: 'Facebook' },
  { key: 'social.youtube', network: 'youtube', label: 'YouTube' },
  { key: 'social.linkedin', network: 'linkedin', label: 'LinkedIn' },
  { key: 'social.x', network: 'x', label: 'X' },
  { key: 'social.whatsapp', network: 'whatsapp', label: 'WhatsApp' },
];

/**
 * A configured social URL, or `null`.
 *
 * **This is a guard, not a tidy-up.** The values behind it are typed into a
 * text box on `/admin/config` and rendered into an `href` on every public page
 * in the product, which is precisely the shape of an injected `javascript:` or
 * `data:` URI — so the scheme is checked here, once, on the way out, rather
 * than trusted at six render sites. `https:` only: a marketing profile served
 * over plain HTTP in 2026 is a mistake worth refusing rather than proxying to a
 * buyer, and an unparseable value is a typo the operator should see as a
 * missing icon rather than as a dead link.
 */
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
        // Which intake screen to open, and whether listing pages carry a
        // records check. Both are read here rather than in the web app so a
        // flag flip takes effect without a redeploy.
        rcLookupEnabled: rcLookup,
        vehicleReportEnabled: vehicleReport,
        // Only the networks that have a publishable URL. The footer draws what
        // it is given, so "no Instagram account yet" is an absent entry here
        // rather than a rule in a component.
        social,
      };
    },
  };
}

export type ConfigService = ReturnType<typeof createConfigService>;
