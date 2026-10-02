import { PublicLocations } from '@dealers-drive/contracts';
import { cache } from 'react';

import { apiGetParsed } from '@/lib/api';
import { DEALERS_TAG } from '@/lib/cache-tags';
import { logger } from '@/lib/logger';

export const NO_LOCATIONS: PublicLocations = {
  districts: [],
  total: 0,
  cars: { total: 0, districts: {} },
};

export const getPublicLocations = cache(async (): Promise<PublicLocations> => {
  return apiGetParsed(PublicLocations, '/v1/locations', {
    revalidate: 600,
    tags: [DEALERS_TAG],
  }).catch((error: unknown) => {
    logger.warn('locations.unavailable', { error });
    return NO_LOCATIONS;
  });
});
