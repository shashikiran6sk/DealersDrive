import Link from 'next/link';

import { LinkPendingLabel } from '@/components/ui/link-pending';
import { StatusTag } from '@/components/ui/primitives';

import { SUPPORT_QUEUE_PATH, SUPPORT_QUEUE_TEXT } from './support-queue.constants';
import type { SupportQueueRowProps } from './support-queue.types';

export function SupportQueueRow({ row }: SupportQueueRowProps) {
  return (
    <tr>
      <td className="min-w-[180px] max-w-[240px]">
        <div className="font-mono text-[11px] ink-subtle">{row.reference}</div>
        <div className="truncate text-[13px] font-medium" title={row.subject}>
          {row.subject}
        </div>
        <div className="text-[11px] ink-subtle">{row.categoryLabel}</div>
      </td>
      <td className="min-w-[150px]">
        <div className="text-[13px] font-medium">{row.customer.name}</div>
        <div className="font-mono text-[11px] whitespace-nowrap ink-subtle tnum">
          {row.customer.phoneDisplay ?? SUPPORT_QUEUE_TEXT.noNumber}
        </div>
      </td>
      <td className="min-w-[170px] max-xl:hidden">
        {row.context ? (
          <>
            <div className="text-[12px] font-medium">{row.context.vehicleTitle}</div>
            <div className="text-[11px] ink-subtle">{row.context.dealerName}</div>
          </>
        ) : (
          <span className="text-[12px] ink-faint">{SUPPORT_QUEUE_TEXT.noContext}</span>
        )}
      </td>
      <td>
        <div className="flex flex-col items-start gap-[4px]">
          <StatusTag tone={row.statusTone}>{row.statusLabel}</StatusTag>
          <StatusTag tone={row.priorityTone}>
            {SUPPORT_QUEUE_TEXT.priority(row.priorityLabel)}
          </StatusTag>
        </div>
      </td>
      <td className="min-w-[110px] text-[12px]">
        {row.assignee ? (
          row.assignee.label
        ) : (
          <span className="ink-faint">{SUPPORT_QUEUE_TEXT.nobody}</span>
        )}
      </td>
      <td className="whitespace-nowrap">
        <time dateTime={row.updatedAt} className="text-[12px] tnum">
          {row.updatedLabel}
        </time>
      </td>
      <td className="text-right">
        <Link
          href={`${SUPPORT_QUEUE_PATH}/${row.id}`}
          aria-label={SUPPORT_QUEUE_TEXT.viewLabel(row.reference)}
          className="relative btn btn-secondary text-[12px]"
        >
          <LinkPendingLabel>{SUPPORT_QUEUE_TEXT.view}</LinkPendingLabel>
        </Link>
      </td>
    </tr>
  );
}
