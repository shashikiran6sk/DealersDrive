import type { DealerInventoryRow } from '@dealers-drive/contracts';
import Link from 'next/link';

import { StatusTag } from '@/components/ui/primitives';
import { ListingLifecycleActions } from '@/features/dealer/listing-lifecycle';

import { INVENTORY_TEXT } from './inventory.constants';
import { vehicleHref } from './utils';

export function InventoryRow({ row }: { row: DealerInventoryRow }) {
  return (
    <tr>
      <td className="min-w-[220px]">
        <Link href={vehicleHref(row)} className="text-[13px] font-medium text-(--color-ink)">
          {row.title}
        </Link>
        <div className="font-mono text-[11px] ink-subtle">{row.registrationDisplay}</div>
        {row.summary ? <div className="text-[11px] ink-subtle tnum">{row.summary}</div> : null}
        {row.reason ? (
          <div className="mt-[3px] max-w-[48ch] text-[11px] text-(--color-warn)">
            {INVENTORY_TEXT.changesRequested} {row.reason}
          </div>
        ) : null}
      </td>
      <td className="whitespace-nowrap tnum">
        {row.priceLabel ?? <span className="ink-faint">{INVENTORY_TEXT.noPrice}</span>}
      </td>
      <td>
        <StatusTag tone={row.statusTone}>{row.statusLabel}</StatusTag>
        {!row.complete && row.status === 'DRAFT' ? (
          <div className="mt-[3px] text-[11px] ink-subtle">{INVENTORY_TEXT.incomplete}</div>
        ) : null}
      </td>
      <td className="whitespace-nowrap text-[12px] ink-subtle tnum">{row.updatedLabel}</td>
      <td className="text-right">
        <div className="flex flex-wrap items-center justify-end gap-[6px]">
          <ListingLifecycleActions
            vehicleId={row.id}
            vehicleTitle={row.title}
            actions={row.actions}
            size="sm"
          />
          <Link href={vehicleHref(row)} className="btn btn-ghost text-[12px]">
            {row.status === 'DRAFT' || row.status === 'CHANGES_REQUESTED'
              ? INVENTORY_TEXT.edit
              : INVENTORY_TEXT.open}
          </Link>
        </div>
      </td>
    </tr>
  );
}
