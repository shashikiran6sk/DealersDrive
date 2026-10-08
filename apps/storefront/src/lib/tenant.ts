import 'server-only';

import {
  PublicStorefrontDto,
  StorefrontInventoryQuery,
  StorefrontInventoryResponse,
  StorefrontVehicleResponse,
} from '@dealers-drive/contracts';
import { notFound } from 'next/navigation';
import { cache } from 'react';

import { StorefrontApiError, storefrontRequest } from './api';

export const getSite = cache(async () => {
  try {
    return await storefrontRequest(PublicStorefrontDto, '/site');
  } catch (error) {
    if (error instanceof StorefrontApiError && error.status === 404) notFound();
    throw error;
  }
});

export async function getInventory(query: Record<string, string | string[] | undefined>) {
  const clean = Object.fromEntries(
    Object.entries(query).filter(([, value]) => value !== '' && value !== undefined),
  );
  const parsed = StorefrontInventoryQuery.safeParse(clean);
  if (!parsed.success) throw new StorefrontApiError(400);
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(clean))
    if (value !== undefined) params.set(key, Array.isArray(value) ? value.join(',') : value);
  return storefrontRequest(StorefrontInventoryResponse, `/cars?${params}`);
}

export const getCar = cache(async (slug: string) => {
  try {
    return await storefrontRequest(StorefrontVehicleResponse, `/cars/${encodeURIComponent(slug)}`);
  } catch (error) {
    if (error instanceof StorefrontApiError && error.status === 404) notFound();
    throw error;
  }
});
