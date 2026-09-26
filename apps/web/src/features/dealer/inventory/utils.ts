import type { DealerInventoryRow } from '@dealers-drive/contracts';

import { qs } from '@/lib/api';

import { INVENTORY_PATH } from './inventory.constants';

export function vehicleHref(row: Pick<DealerInventoryRow, 'id'>): string {
  return `/dealer/vehicles/${row.id}/edit?step=review`;
}

export function inventoryHref(params: { status?: string; q?: string; cursor?: string }): string {
  return `${INVENTORY_PATH}${qs(params)}`;
}
