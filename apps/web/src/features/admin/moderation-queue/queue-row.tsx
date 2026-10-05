import type { AdminListingRow } from '@dealers-drive/contracts';
import Link from 'next/link';

import { LinkPendingLabel } from '@/components/ui/link-pending';
import { StatusTag } from '@/components/ui/primitives';

import { MODERATION_TEXT } from './moderation-queue.constants';

export function QueueRow({ row }: { row: AdminListingRow }) {
  return (
    <tr>
      <td className="min-w-[220px]">
        <div className="text-[13px] font-medium">{row.title}</div>
        <div className="font-mono text-[11px] ink-subtle">{row.registrationDisplay}</div>
        {row.summary ? <div className="text-[11px] ink-subtle tnum">{row.summary}</div> : null}
      </td>
      <td>
        <Link href={`/admin/dealers/${row.dealer.id}`} className="text-[13px]">
          {row.dealer.name}
        </Link>
      </td>
      <td className="whitespace-nowrap tnum">
        {row.priceLabel ?? <span className="ink-faint">{MODERATION_TEXT.noPrice}</span>}
      </td>
      <td className="text-[13px]">{row.location ?? '—'}</td>
      <td className="whitespace-nowrap">
        <div className="text-[12px] tnum">{row.submittedLabel ?? '—'}</div>
        {row.waitingLabel ? (
          <div className="text-[11px] text-(--color-warn) tnum">{row.waitingLabel}</div>
        ) : null}
      </td>
      <td>
        <div className="flex flex-wrap items-center gap-[6px]">
          <StatusTag tone={row.statusTone}>{row.statusLabel}</StatusTag>
          <StatusTag tone={row.photography.tone}>{row.photography.label}</StatusTag>
          <span className="text-[11px] ink-subtle tnum">
            {MODERATION_TEXT.images(row.imageCount)}
          </span>
          {row.resubmission ? (
            <StatusTag tone="neutral">{MODERATION_TEXT.resubmitted}</StatusTag>
          ) : null}
        </div>
      </td>
      <td className="text-right">
        <Link href={`/admin/listings/${row.id}`} className="relative btn btn-secondary text-[12px]">
          <LinkPendingLabel>{MODERATION_TEXT.review}</LinkPendingLabel>
        </Link>
      </td>
    </tr>
  );
}
