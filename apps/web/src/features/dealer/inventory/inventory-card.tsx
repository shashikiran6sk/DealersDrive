import type { DealerInventoryRow } from '@dealers-drive/contracts';
import Link from 'next/link';

import { StatusTag } from '@/components/ui/primitives';
import { ListingLifecycleActions } from '@/features/dealer/listing-lifecycle';

import { INVENTORY_TEXT } from './inventory.constants';
import { vehicleHref } from './utils';

export function InventoryCard({ row }: { row: DealerInventoryRow }) {
  return (
    <li className="card flex flex-col gap-[10px] bg-white p-[16px] text-(--color-ink) shadow-sm">
      <Link
        href={vehicleHref(row)}
        className="flex flex-col gap-[8px] text-(--color-ink) no-underline"
      >
        <div className="flex items-start justify-between gap-[10px]">
          <div className="min-w-0">
            <div className="truncate text-[15px] font-extrabold tracking-[-0.015em]">
              {row.title}
            </div>
            <div className="font-mono text-[11px] ink-subtle">{row.registrationDisplay}</div>
          </div>
          <StatusTag tone={row.statusTone}>{row.statusLabel}</StatusTag>
        </div>
        <div className="flex flex-wrap items-baseline justify-between gap-[8px] border-t border-(--color-divider) pt-[8px]">
          <span className="text-[12px] ink-muted tnum">{row.summary}</span>
          <span className="text-[17px] font-extrabold tracking-[-0.02em] tnum">
            {row.priceLabel ?? INVENTORY_TEXT.noPrice}
          </span>
        </div>
        {row.reason ? (
          <div className="text-[12px] text-(--color-warn)">
            {INVENTORY_TEXT.changesRequested} {row.reason}
          </div>
        ) : null}
      </Link>
      <ListingLifecycleActions
        vehicleId={row.id}
        vehicleTitle={row.title}
        actions={row.actions}
        reactivationPending={row.reactivationPending}
        size="sm"
      />
    </li>
  );
}
