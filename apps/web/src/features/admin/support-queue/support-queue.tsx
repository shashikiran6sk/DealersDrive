import Link from 'next/link';

import { LinkPendingLabel } from '@/components/ui/link-pending';
import { EmptyState } from '@/components/ui/primitives';
import { Table, type TableColumn } from '@/components/ui/table';

import { SUPPORT_QUEUE_TEXT } from './support-queue.constants';
import { SupportQueueFilters } from './support-queue-filters';
import { SupportQueueRow } from './support-queue-row';
import { SupportQueueTabs } from './support-queue-tabs';
import type { SupportQueueProps } from './support-queue.types';
import { isQueueFiltered, supportQueueHref } from './utils';

const COLUMNS: TableColumn[] = [
  { key: 'ticket', label: SUPPORT_QUEUE_TEXT.colTicket },
  { key: 'customer', label: SUPPORT_QUEUE_TEXT.colCustomer },
  {
    key: 'context',
    label: SUPPORT_QUEUE_TEXT.colContext,
    className: 'max-xl:hidden max-md:table-cell',
  },
  { key: 'status', label: SUPPORT_QUEUE_TEXT.colStatus },
  { key: 'assignee', label: SUPPORT_QUEUE_TEXT.colAssignee },
  { key: 'updated', label: SUPPORT_QUEUE_TEXT.colUpdated },
  { key: 'actions', label: SUPPORT_QUEUE_TEXT.colActions, align: 'right' },
];

export function SupportQueue({ tickets, filters }: SupportQueueProps) {
  const narrowed = isQueueFiltered(filters) || filters.status !== undefined;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-[6px]">
        <div className="flex flex-wrap items-baseline gap-3">
          <h1 className="text-[26px]">{SUPPORT_QUEUE_TEXT.title}</h1>
          <span className="text-[13px] ink-muted tnum">
            {SUPPORT_QUEUE_TEXT.total(tickets.counts.ALL)}
          </span>
        </div>
        <p className="max-w-[72ch] text-[13px] ink-muted">{SUPPORT_QUEUE_TEXT.intro}</p>
      </div>

      <SupportQueueTabs counts={tickets.counts} filters={filters} />
      <SupportQueueFilters filters={filters} assignees={tickets.assignees} />

      {tickets.data.length === 0 ? (
        narrowed ? (
          <EmptyState
            title={SUPPORT_QUEUE_TEXT.filteredEmptyTitle}
            message={SUPPORT_QUEUE_TEXT.filteredEmptyMessage}
          />
        ) : (
          <EmptyState
            title={SUPPORT_QUEUE_TEXT.emptyTitle}
            message={SUPPORT_QUEUE_TEXT.emptyMessage}
          />
        )
      ) : (
        <Table columns={COLUMNS} caption={SUPPORT_QUEUE_TEXT.caption}>
          {tickets.data.map((row) => (
            <SupportQueueRow key={row.id} row={row} />
          ))}
        </Table>
      )}

      {tickets.page.nextCursor ? (
        <Link
          href={supportQueueHref({ ...filters, cursor: tickets.page.nextCursor })}
          className="relative btn btn-secondary self-center"
        >
          <LinkPendingLabel>{SUPPORT_QUEUE_TEXT.more}</LinkPendingLabel>
        </Link>
      ) : null}
    </div>
  );
}
