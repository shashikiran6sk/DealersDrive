import {
  NOTIFICATION_STATUS_LABELS,
  type AdminNotificationsResponse,
} from '@dealers-drive/contracts';
import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { EmptyState, StatusTag } from '@/components/ui/primitives';
import { Table, type TableColumn } from '@/components/ui/table';
import { cn } from '@/lib/cn';

import { NOTIFICATION_LOG_TEXT, NOTIFICATION_TABS } from './notification-log.constants';
import { logHref, type NotificationLogFilters } from './utils';

const COLUMNS: TableColumn[] = [
  { key: 'when', label: NOTIFICATION_LOG_TEXT.colWhen },
  { key: 'to', label: NOTIFICATION_LOG_TEXT.colTo },
  { key: 'email', label: NOTIFICATION_LOG_TEXT.colEmail },
  {
    key: 'dealer',
    label: NOTIFICATION_LOG_TEXT.colDealer,
    className: 'max-lg:hidden max-md:table-cell',
  },
  { key: 'status', label: NOTIFICATION_LOG_TEXT.colStatus },
];

export function NotificationLog({
  deliveries,
  filters,
}: {
  deliveries: AdminNotificationsResponse;
  filters: NotificationLogFilters;
}) {
  return (
    <div className="flex flex-col gap-4 max-md:min-w-0">
      <div className="flex flex-col gap-[6px]">
        <div className="flex flex-wrap items-baseline gap-3">
          <h1 className="text-[26px]">{NOTIFICATION_LOG_TEXT.title}</h1>
          <span className="text-[13px] ink-muted tnum">
            {NOTIFICATION_LOG_TEXT.total(deliveries.counts.ALL)}
          </span>
        </div>
        <p className="max-w-[72ch] text-[13px] ink-muted">{NOTIFICATION_LOG_TEXT.intro}</p>
      </div>

      <nav aria-label={NOTIFICATION_LOG_TEXT.colStatus} className="flex flex-wrap gap-2">
        {NOTIFICATION_TABS.map((tab) => {
          const status = tab === 'ALL' ? undefined : tab;
          const current = filters.status === status;
          return (
            <Link
              key={tab}
              href={logHref({ ...filters, status })}
              aria-current={current ? 'page' : undefined}
              className={cn(
                'rounded-full border px-3 py-1 text-[13px]',
                current
                  ? 'border-(--color-ink) bg-(--color-ink) text-white'
                  : 'border-(--color-divider) bg-white',
              )}
            >
              {tab === 'ALL' ? NOTIFICATION_LOG_TEXT.tabAll : NOTIFICATION_STATUS_LABELS[tab]}{' '}
              <span className="tnum">{deliveries.counts[tab]}</span>
            </Link>
          );
        })}
      </nav>

      <form action={logHref({})} method="get" className="flex flex-wrap items-end gap-2">
        {filters.status ? <input type="hidden" name="status" value={filters.status} /> : null}
        <label className="flex min-w-[240px] max-md:min-w-0 max-md:max-w-full flex-1 flex-col gap-1 text-[12px] ink-muted">
          {NOTIFICATION_LOG_TEXT.searchLabel}
          <Input
            name="q"
            defaultValue={filters.q ?? ''}
            placeholder={NOTIFICATION_LOG_TEXT.searchPlaceholder}
          />
        </label>
        <Button type="submit" variant="secondary">
          {NOTIFICATION_LOG_TEXT.search}
        </Button>
        {filters.q ? (
          <Link href={logHref({ status: filters.status })} className="text-[13px]">
            {NOTIFICATION_LOG_TEXT.clear}
          </Link>
        ) : null}
      </form>

      {deliveries.data.length === 0 ? (
        <EmptyState
          title={NOTIFICATION_LOG_TEXT.emptyTitle}
          message={NOTIFICATION_LOG_TEXT.emptyMessage}
        />
      ) : (
        <Table
          scrollHint
          columns={COLUMNS}
          caption={NOTIFICATION_LOG_TEXT.caption}
          className="max-md:min-w-[640px]"
        >
          {deliveries.data.map((row) => (
            <tr key={row.id}>
              <td className="whitespace-nowrap text-[12px] tnum">{row.createdLabel}</td>
              <td className="max-w-[220px] break-all text-[13px]">{row.recipient}</td>
              <td className="text-[13px]">
                <div className="font-medium">{row.subject}</div>
                <div className="font-mono text-[11px] ink-muted">{row.template}</div>
                {row.lastError ? (
                  <div className="mt-1 text-[12px] text-(--color-err)">{row.lastError}</div>
                ) : null}
              </td>
              <td className="text-[13px] max-lg:hidden max-md:table-cell">
                {row.dealer?.name ?? '—'}
              </td>
              <td>
                <StatusTag tone={row.statusTone}>{row.statusLabel}</StatusTag>
                <div className="mt-1 text-[11px] ink-muted">
                  {NOTIFICATION_LOG_TEXT.attempts(row.attempts)}
                </div>
              </td>
            </tr>
          ))}
        </Table>
      )}

      {deliveries.page.nextCursor ? (
        <Link
          href={logHref(filters, deliveries.page.nextCursor)}
          className="self-start text-[13px] font-semibold"
        >
          {NOTIFICATION_LOG_TEXT.older}
        </Link>
      ) : null}
    </div>
  );
}
