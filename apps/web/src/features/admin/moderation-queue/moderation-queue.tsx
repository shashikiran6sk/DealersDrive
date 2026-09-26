import type { AdminListingsResponse } from '@dealers-drive/contracts';
import Link from 'next/link';

import { Input } from '@/components/ui/input';
import { EmptyState } from '@/components/ui/primitives';
import { Table, type TableColumn } from '@/components/ui/table';
import { qs } from '@/lib/api';

import { MODERATION_PATH, MODERATION_TABS, MODERATION_TEXT } from './moderation-queue.constants';
import { QueueRow } from './queue-row';

const COLUMNS: TableColumn[] = [
  { key: 'vehicle', label: 'Vehicle' },
  { key: 'dealer', label: 'Dealer' },
  { key: 'price', label: 'Price' },
  { key: 'location', label: 'Location' },
  { key: 'submitted', label: 'Submitted' },
  { key: 'status', label: 'Status' },
];

function href(params: { status?: string; q?: string; cursor?: string }): string {
  return `${MODERATION_PATH}${qs(params)}`;
}

export function ModerationQueue({ listings, q }: { listings: AdminListingsResponse; q?: string }) {
  const status = listings.status;
  const pending = listings.counts.PENDING_REVIEW ?? 0;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-baseline gap-3">
        <h1 className="text-[26px]">{MODERATION_TEXT.title}</h1>
        <span className="text-[13px] text-(--color-warn) tnum">
          {MODERATION_TEXT.waiting(pending)}
        </span>
      </div>

      <nav aria-label={MODERATION_TEXT.tabsLabel} className="overflow-x-auto">
        <div className="seg">
          {MODERATION_TABS.map((tab) => (
            <Link
              key={tab.value}
              href={href({ status: tab.value === 'PENDING_REVIEW' ? undefined : tab.value, q })}
              aria-current={status === tab.value ? 'page' : undefined}
              aria-selected={status === tab.value}
              className="seg-opt whitespace-nowrap no-underline"
            >
              {tab.label}
              <span className="tnum ink-subtle">{listings.counts[tab.value] ?? 0}</span>
            </Link>
          ))}
        </div>
      </nav>

      <form
        method="get"
        action={MODERATION_PATH}
        role="search"
        className="flex flex-wrap items-center gap-[8px]"
      >
        {status !== 'PENDING_REVIEW' ? <input type="hidden" name="status" value={status} /> : null}
        <label htmlFor="moderation-q" className="sr-only">
          {MODERATION_TEXT.searchLabel}
        </label>
        <Input
          id="moderation-q"
          name="q"
          type="search"
          defaultValue={q ?? ''}
          placeholder={MODERATION_TEXT.searchPlaceholder}
          className="max-w-[300px]"
        />
        <button type="submit" className="btn btn-secondary">
          {MODERATION_TEXT.search}
        </button>
        {q ? (
          <Link
            href={href({ status: status === 'PENDING_REVIEW' ? undefined : status })}
            className="btn btn-ghost text-[12px]"
          >
            {MODERATION_TEXT.clear}
          </Link>
        ) : null}
      </form>

      {listings.data.length === 0 ? (
        status === 'PENDING_REVIEW' && !q ? (
          <EmptyState
            title={MODERATION_TEXT.queueClearTitle}
            message={MODERATION_TEXT.queueClearMessage}
          />
        ) : (
          <EmptyState title={MODERATION_TEXT.emptyTitle} message={MODERATION_TEXT.emptyMessage} />
        )
      ) : (
        <Table columns={COLUMNS} caption={MODERATION_TEXT.caption}>
          {listings.data.map((row) => (
            <QueueRow key={row.id} row={row} />
          ))}
        </Table>
      )}

      {listings.page.nextCursor ? (
        <Link
          href={href({
            status: status === 'PENDING_REVIEW' ? undefined : status,
            q,
            cursor: listings.page.nextCursor,
          })}
          className="btn btn-secondary self-center"
        >
          {MODERATION_TEXT.more}
        </Link>
      ) : null}
    </div>
  );
}
