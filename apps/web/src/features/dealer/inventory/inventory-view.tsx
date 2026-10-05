import type { DealerInventoryResponse, ListingStatus } from '@dealers-drive/contracts';
import Link from 'next/link';

import { ADD_VEHICLE_HREF } from '@/components/dealer/console-nav';
import { ButtonLink } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { LinkPendingLabel } from '@/components/ui/link-pending';
import { EmptyState } from '@/components/ui/primitives';
import { Table, type TableColumn } from '@/components/ui/table';

import { InventoryCard } from './inventory-card';
import { INVENTORY_PATH, INVENTORY_TABS, INVENTORY_TEXT } from './inventory.constants';
import { InventoryRow } from './inventory-row';
import { inventoryHref } from './utils';

const COLUMNS: TableColumn[] = [
  { key: 'vehicle', label: 'Vehicle' },
  { key: 'price', label: 'Price' },
  { key: 'status', label: 'Status' },
  { key: 'updated', label: 'Updated' },
  { key: 'actions', label: 'Actions', align: 'right' },
];

export interface InventoryViewProps {
  inventory: DealerInventoryResponse;
  status?: ListingStatus;
  q?: string;
}

export function InventoryView({ inventory, status, q }: InventoryViewProps) {
  const total = inventory.counts.ALL ?? 0;
  const filtered = Boolean(status || q);

  return (
    <div className="flex flex-col gap-[18px]">
      <div className="flex flex-wrap items-end justify-between gap-[12px]">
        <div>
          <h1 className="text-[25px] tracking-[-0.035em] md:text-[30px]">{INVENTORY_TEXT.title}</h1>
          <p className="text-[13px] ink-muted tnum">{INVENTORY_TEXT.count(total)}</p>
        </div>
        <ButtonLink href={ADD_VEHICLE_HREF} variant="primary">
          {INVENTORY_TEXT.addVehicle}
        </ButtonLink>
      </div>

      <nav aria-label={INVENTORY_TEXT.tabsLabel} className="-mx-1 overflow-x-auto px-1 pb-1">
        <div className="flex gap-[8px]">
          {INVENTORY_TABS.map((tab) => (
            <Link
              key={tab.label}
              href={inventoryHref({ status: tab.value, q })}
              aria-current={status === tab.value ? 'page' : undefined}
              aria-selected={status === tab.value}
              className="relative dd-chip no-underline"
            >
              <LinkPendingLabel>
                {tab.label}
                <span className="tnum opacity-70">{inventory.counts[tab.value ?? 'ALL'] ?? 0}</span>
              </LinkPendingLabel>
            </Link>
          ))}
        </div>
      </nav>

      <form
        method="get"
        action={INVENTORY_PATH}
        role="search"
        className="flex flex-wrap items-center gap-[8px]"
      >
        {status ? <input type="hidden" name="status" value={status} /> : null}
        <label htmlFor="inventory-q" className="sr-only">
          {INVENTORY_TEXT.searchLabel}
        </label>
        <Input
          id="inventory-q"
          name="q"
          type="search"
          defaultValue={q ?? ''}
          placeholder={INVENTORY_TEXT.searchPlaceholder}
          className="max-w-[370px]"
        />
        <button type="submit" className="btn btn-secondary">
          {INVENTORY_TEXT.search}
        </button>
        {q ? (
          <Link href={inventoryHref({ status })} className="relative btn btn-ghost text-[12px]">
            <LinkPendingLabel>{INVENTORY_TEXT.clear}</LinkPendingLabel>
          </Link>
        ) : null}
      </form>

      {inventory.data.length === 0 ? (
        <EmptyState
          title={filtered ? INVENTORY_TEXT.emptyFilteredTitle : INVENTORY_TEXT.emptyTitle}
          message={filtered ? INVENTORY_TEXT.emptyFilteredMessage : INVENTORY_TEXT.emptyMessage}
          action={
            filtered ? null : (
              <ButtonLink href={ADD_VEHICLE_HREF} variant="primary">
                {INVENTORY_TEXT.addVehicle}
              </ButtonLink>
            )
          }
        />
      ) : (
        <>
          <div className="max-md:hidden">
            <Table columns={COLUMNS} caption={INVENTORY_TEXT.caption}>
              {inventory.data.map((row) => (
                <InventoryRow key={row.id} row={row} />
              ))}
            </Table>
          </div>
          <ul className="flex flex-col gap-[10px] md:hidden">
            {inventory.data.map((row) => (
              <InventoryCard key={row.id} row={row} />
            ))}
          </ul>
        </>
      )}

      {inventory.page.nextCursor ? (
        <Link
          href={inventoryHref({ status, q, cursor: inventory.page.nextCursor })}
          className="relative btn btn-secondary self-center"
        >
          <LinkPendingLabel>{INVENTORY_TEXT.more}</LinkPendingLabel>
        </Link>
      ) : null}
    </div>
  );
}
