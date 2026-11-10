import { PublicVehiclesResponse, type VehicleCardDto } from '@dealers-drive/contracts';

import { apiGetParsed, qs } from '@/lib/api';
import { VEHICLES_TAG } from '@/lib/cache-tags';
import { logger } from '@/lib/logger';
import { searchHref } from '@/lib/vehicle-search';

import type { HomeCategoryView } from './category-deck/category-deck.types';
import type { MakeLink } from './makes-strip/makes-strip.types';
import {
  CATEGORY_CAR_COUNT,
  HOME_CATEGORIES,
  HOME_SEARCH_PATH,
  RECENT_CAR_COUNT,
} from './home.constants';
import { categoryHref } from './utils';

export interface HomeInventory {
  recent: VehicleCardDto[];
  makes: MakeLink[];
  categories: HomeCategoryView[];
  unavailable: boolean;
}

const UNAVAILABLE: HomeInventory = { recent: [], makes: [], categories: [], unavailable: true };

const READ = { revalidate: 60, tags: [VEHICLES_TAG] };

function availableOnly(response: PublicVehiclesResponse | undefined): VehicleCardDto[] {
  return (response?.data ?? []).filter((car) => car.availability === 'AVAILABLE');
}

export async function loadHomeInventory(): Promise<HomeInventory> {
  try {
    const [recent, ...categories] = await Promise.all([
      apiGetParsed(PublicVehiclesResponse, `/v1/vehicles${qs({ limit: RECENT_CAR_COUNT })}`, READ),
      ...HOME_CATEGORIES.map((category) =>
        apiGetParsed(
          PublicVehiclesResponse,
          `/v1/vehicles${qs({ ...category.params, limit: CATEGORY_CAR_COUNT })}`,
          READ,
        ),
      ),
    ]);
    return {
      recent: availableOnly(recent),
      makes: (recent?.facets.brands ?? []).map((brand) => ({
        label: brand.label,
        href: searchHref(HOME_SEARCH_PATH, { brand: brand.value }),
      })),
      categories: HOME_CATEGORIES.map((category, index) => ({
        ...category,
        href: categoryHref(category),
        cars: availableOnly(categories[index]),
      })),
      unavailable: false,
    };
  } catch (error) {
    logger.warn('home.inventory_unavailable', { error });
    return UNAVAILABLE;
  }
}
