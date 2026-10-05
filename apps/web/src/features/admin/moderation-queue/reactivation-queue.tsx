import Link from 'next/link';

import { LinkPendingLabel } from '@/components/ui/link-pending';
import { EmptyState } from '@/components/ui/primitives';
import { Table, type TableColumn } from '@/components/ui/table';
import {
  approveReactivationAction,
  rejectReactivationAction,
} from '@/features/admin/listing-actions';
import { qs } from '@/lib/api';

import {
  MODERATION_PATH,
  REACTIVATION_TABS,
  REACTIVATION_TEXT,
  REACTIVATION_VIEW,
} from './moderation-queue.constants';
import type { ReactivationQueueProps } from './moderation-queue.types';
import { ModerationTabs } from './moderation-tabs';
import { ReactivationRow } from './reactivation-row';

const COLUMNS: TableColumn[] = [
  { key: 'vehicle', label: 'Vehicle' },
  { key: 'dealer', label: 'Dealer' },
  { key: 'status', label: 'Listing now' },
  { key: 'transition', label: 'Requested' },
  { key: 'requested', label: 'Requested on' },
  { key: 'reason', label: 'Dealer’s note' },
  { key: 'actions', label: 'Decision', align: 'right' },
];

function href(params: { status?: string; cursor?: string }): string {
  return `${MODERATION_PATH}${qs({ view: REACTIVATION_VIEW, ...params })}`;
}

export function ReactivationQueue({
  requests,
  listingCounts,
  approve = approveReactivationAction,
  reject = rejectReactivationAction,
}: ReactivationQueueProps) {
  const status = requests.status;
  const pending = requests.counts.PENDING ?? 0;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-baseline gap-3">
        <h1 className="text-[26px]">{REACTIVATION_TEXT.title}</h1>
        <span className="text-[13px] text-(--color-warn) tnum">
          {REACTIVATION_TEXT.waiting(pending)}
        </span>
      </div>

      <ModerationTabs active="REACTIVATION" counts={listingCounts} reactivationPending={pending} />

      <p className="m-0 max-w-[72ch] text-[13px] ink-subtle">{REACTIVATION_TEXT.intro}</p>

      <nav aria-label={REACTIVATION_TEXT.tabsLabel} className="overflow-x-auto">
        <div className="seg">
          {REACTIVATION_TABS.map((tab) => (
            <Link
              key={tab.value}
              href={href({ status: tab.value === 'PENDING' ? undefined : tab.value })}
              aria-current={status === tab.value ? 'page' : undefined}
              aria-selected={status === tab.value}
              className="seg-opt whitespace-nowrap no-underline"
            >
              {tab.label}
              <span className="tnum ink-subtle">{requests.counts[tab.value] ?? 0}</span>
            </Link>
          ))}
        </div>
      </nav>

      {requests.data.length === 0 ? (
        status === 'PENDING' ? (
          <EmptyState
            title={REACTIVATION_TEXT.clearTitle}
            message={REACTIVATION_TEXT.clearMessage}
          />
        ) : (
          <EmptyState
            title={REACTIVATION_TEXT.emptyTitle}
            message={REACTIVATION_TEXT.emptyMessage}
          />
        )
      ) : (
        <Table columns={COLUMNS} caption={REACTIVATION_TEXT.caption}>
          {requests.data.map((row) => (
            <ReactivationRow key={row.id} row={row} approve={approve} reject={reject} />
          ))}
        </Table>
      )}

      {requests.page.nextCursor ? (
        <Link
          href={href({
            status: status === 'PENDING' ? undefined : status,
            cursor: requests.page.nextCursor,
          })}
          className="relative btn btn-secondary self-center"
        >
          <LinkPendingLabel>{REACTIVATION_TEXT.more}</LinkPendingLabel>
        </Link>
      ) : null}
    </div>
  );
}
