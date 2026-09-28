'use server';

import { PublicVehicleQuery, PublicVehiclesResponse } from '@dealers-drive/contracts';

import { apiGetParsed, qs } from '@/lib/api';
import { VEHICLES_TAG } from '@/lib/cache-tags';

import type { HeroFacets } from './hero-search/hero-search.types';

const NONE: HeroFacets = { brands: [], models: [] };

export async function heroFacetsAction(district?: string, brand?: string): Promise<HeroFacets> {
  const query = PublicVehicleQuery.safeParse({
    ...(district ? { district } : {}),
    ...(brand ? { brand } : {}),
    limit: 1,
  });
  if (!query.success) return NONE;

  try {
    const { facets } = await apiGetParsed(
      PublicVehiclesResponse,
      `/v1/vehicles${qs({ district, brand, limit: 1 })}`,
      { revalidate: 60, tags: [VEHICLES_TAG] },
    );
    return { brands: facets.brands, models: brand ? facets.models : [] };
  } catch {
    return NONE;
  }
}
