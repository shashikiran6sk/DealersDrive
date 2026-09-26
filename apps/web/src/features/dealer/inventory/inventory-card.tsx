import type { DealerInventoryRow } from '@dealers-drive/contracts';
import Link from 'next/link';

import { StatusTag } from '@/components/ui/primitives';

import { INVENTORY_TEXT } from './inventory.constants';
import { vehicleHref } from './utils';

export function InventoryCard({ row }: { row: DealerInventoryRow }) {
  return (
    <li>
      <Link
        href={vehicleHref(row)}
        className="card flex flex-col gap-[8px] bg-white p-[14px] text-(--color-ink) no-underline"
      >
        <div className="flex items-start justify-between gap-[10px]">
          <div className="min-w-0">
            <div className="truncate text-[14px] font-semibold">{row.title}</div>
            <div className="font-mono text-[11px] ink-subtle">{row.registrationDisplay}</div>
          </div>
          <StatusTag tone={row.statusTone}>{row.statusLabel}</StatusTag>
        </div>
        <div className="flex flex-wrap items-baseline justify-between gap-[8px] border-t border-(--color-divider) pt-[8px]">
          <span className="text-[12px] ink-muted tnum">{row.summary}</span>
          <span className="text-[15px] font-semibold tnum">
            {row.priceLabel ?? INVENTORY_TEXT.noPrice}
          </span>
        </div>
        {row.reason ? (
          <div className="text-[12px] text-(--color-warn)">
            {INVENTORY_TEXT.changesRequested} {row.reason}
          </div>
        ) : null}
      </Link>
    </li>
  );
}
