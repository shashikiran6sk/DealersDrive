import { searchHref, setParam, type VehicleSearchParams } from '@/lib/vehicle-search';

import { INVENTORY_ANCHOR } from './dealer-inventory.constants';

export function portfolioPath(dealerSlug: string): string {
  return `/dealers/${encodeURIComponent(dealerSlug)}`;
}

export function pageHref(dealerSlug: string, params: VehicleSearchParams, page: number): string {
  const href = searchHref(portfolioPath(dealerSlug), setParam(params, 'page', String(page)));
  return `${href}#${INVENTORY_ANCHOR}`;
}

export function placeOf(parts: readonly (string | null | undefined)[]): string | null {
  const seen: string[] = [];
  for (const part of parts) {
    const value = part?.trim();
    if (value && !seen.includes(value)) seen.push(value);
  }
  return seen.length > 0 ? seen.join(', ') : null;
}
