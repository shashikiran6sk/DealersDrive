import { PublicConfig } from '@dealers-drive/contracts';

import { apiGetParsed } from '@/lib/api';
import { CONFIG_TAG } from '@/lib/cache-tags';

export const NO_PUBLIC_CONFIG: PublicConfig = {
  mediaBaseUrl: '',
  captchaSiteKey: null,
  supportEmail: '',
  supportPhone: '',
  minPhotosPerListing: 0,
  listingDurationDays: 0,
  enquiryRateLimitPerHour: 0,
  photoRequestsEnabled: false,
  rcLookupEnabled: false,
  vehicleReportEnabled: false,
  social: [],
};

export async function getPublicConfig(): Promise<PublicConfig> {
  return apiGetParsed(PublicConfig, '/v1/config/public', {
    revalidate: 600,
    tags: [CONFIG_TAG],
  }).catch((error: unknown) => {
    console.error('[public-config] unavailable', error);
    return NO_PUBLIC_CONFIG;
  });
}
