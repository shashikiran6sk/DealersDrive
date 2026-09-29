import { PublicVehiclesResponse } from '@dealers-drive/contracts';

import { apiGetParsed, qs } from '@/lib/api';
import { VEHICLES_TAG } from '@/lib/cache-tags';
import { searchHref } from '@/lib/vehicle-search';

import { DISCOVERY_CARD_COUNT, DISCOVERY_SECTIONS } from './home.constants';
import type { DiscoveryRowProps } from './discovery-row/discovery-row.types';

export interface HomeInventory {
  rows: DiscoveryRowProps[];
}

const EMPTY: HomeInventory = { rows: [] };

export async function loadHomeInventory(): Promise<HomeInventory> {
  try {
    const responses = await Promise.all(
      DISCOVERY_SECTIONS.map((section) =>
        apiGetParsed(
          PublicVehiclesResponse,
          `/v1/vehicles${qs({ ...section.params, limit: DISCOVERY_CARD_COUNT })}`,
          { revalidate: 60, tags: [VEHICLES_TAG] },
        ),
      ),
    );
    return {
      rows: DISCOVERY_SECTIONS.map((section, index) => {
        const response = responses[index];
        return {
          id: `home-${section.key}`,
          title: section.title,
          href: searchHref('/cars', section.params),
          cars: (response?.data ?? []).filter((car) => car.availability === 'AVAILABLE'),
        };
      }),
    };
  } catch (error) {
    console.error('[home] inventory unavailable', error);
    return EMPTY;
  }
}
