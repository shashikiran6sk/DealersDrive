import { PublicConfig } from '@dealers-drive/contracts';
import { cache } from 'react';

import { apiGetParsed } from '@/lib/api';
import { CONFIG_TAG } from '@/lib/cache-tags';
import { logger } from '@/lib/logger';

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
  support: {
    customer: { email: '', phone: '' },
    dealer: { email: '', phone: '' },
    whatsappHref: null,
  },
  heroImage: null,
};

export const getPublicConfig = cache(async (): Promise<PublicConfig> => {
  return apiGetParsed(PublicConfig, '/v1/config/public', {
    revalidate: 600,
    tags: [CONFIG_TAG],
  }).catch((error: unknown) => {
    logger.warn('public_config.unavailable', { error });
    return NO_PUBLIC_CONFIG;
  });
});
