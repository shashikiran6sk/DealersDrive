import type { PublicConfig } from '@dealers-drive/contracts';

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

export function createConfigService({ config }: ConfigDeps) {
  return {
    async publicConfig(): Promise<PublicConfig> {
      const [minPhotos, durationDays, enquiryRate, photoRequests, rcLookup, vehicleReport] =
        await Promise.all([
          config.number('listing.minPhotos'),
          config.number('listing.durationDays'),
          config.number('enquiry.rateLimitPerHour'),
          config.boolean('photoRequests.enabled'),
          config.boolean('feature.rcLookup'),
          config.boolean('feature.vehicleReport'),
        ]);

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
        /**
         * **R39.** What the browser needs to ask Firebase for an OTP, or null.
         *
         * From `env` rather than from `PlatformConfig`: this is deployment
         * wiring, not a flag somebody flips at runtime, and a half-applied
         * Firebase project is a screen that cannot send a code. `env.ts`
         * refuses to boot with `PHONE_VERIFICATION_DRIVER=firebase` and any of
         * the three missing, so the `null` here means *this deployment does not
         * do Firebase verification* rather than *somebody forgot a variable*.
         */
        firebase:
          env.PHONE_VERIFICATION_DRIVER === 'firebase' &&
          env.FIREBASE_WEB_API_KEY &&
          env.FIREBASE_AUTH_DOMAIN &&
          env.FIREBASE_PROJECT_ID
            ? {
                apiKey: env.FIREBASE_WEB_API_KEY,
                authDomain: env.FIREBASE_AUTH_DOMAIN,
                projectId: env.FIREBASE_PROJECT_ID,
              }
            : null,
      };
    },
  };
}

export type ConfigService = ReturnType<typeof createConfigService>;
