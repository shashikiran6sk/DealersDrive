import { INVENTORY_ANCHOR } from './dealer-inventory.constants';

export function pageHref(dealerSlug: string, page: number): string {
  const base = `/dealers/${encodeURIComponent(dealerSlug)}`;
  return page > 1 ? `${base}?page=${page}#${INVENTORY_ANCHOR}` : `${base}#${INVENTORY_ANCHOR}`;
}
