import { PublicLocations } from '@dealers-drive/contracts';

import { apiGetParsed } from '@/lib/api';
import { DEALERS_TAG } from '@/lib/cache-tags';

export const NO_LOCATIONS: PublicLocations = { districts: [], total: 0 };

export async function getPublicLocations(): Promise<PublicLocations> {
  return apiGetParsed(PublicLocations, '/v1/locations', {
    revalidate: 600,
    tags: [DEALERS_TAG],
  }).catch((error: unknown) => {
    console.error('[locations] unavailable', error);
    return NO_LOCATIONS;
  });
}
