import Link from 'next/link';

import { StatusTag } from '@/components/ui/primitives';
import { DecisionDialog } from '@/features/admin/listing-review/decision-dialog';

import { REACTIVATION_TEXT } from './moderation-queue.constants';
import type { ReactivationRowProps } from './moderation-queue.types';

export function ReactivationRow({ row, approve, reject }: ReactivationRowProps) {
  const pending = row.status === 'PENDING';

  return (
    <tr>
      <td className="min-w-[220px]">
        <Link href={`/admin/listings/${row.listing.id}`} className="text-[13px] font-medium">
          {row.listing.title}
        </Link>
        <div className="font-mono text-[11px] ink-subtle">{row.listing.registrationDisplay}</div>
      </td>
      <td>
        <Link href={`/admin/dealers/${row.dealer.id}`} className="text-[13px]">
          {row.dealer.name}
        </Link>
      </td>
      <td>
        <div className="flex flex-wrap items-center gap-[6px]">
          <StatusTag tone={row.listing.statusTone}>{row.listing.statusLabel}</StatusTag>
          {!row.current && pending ? (
            <span className="text-[11px] text-(--color-warn)">{REACTIVATION_TEXT.outdated}</span>
          ) : null}
        </div>
      </td>
      <td className="whitespace-nowrap text-[13px]">
        {REACTIVATION_TEXT.transition(row.fromStatusLabel, row.toStatusLabel)}
      </td>
      <td className="whitespace-nowrap text-[12px] tnum">{row.requestedLabel}</td>
      <td className="max-w-[36ch] text-[12px]">
        {row.reason ?? <span className="ink-faint">{REACTIVATION_TEXT.noReason}</span>}
      </td>
      <td className="text-right">
        {pending ? (
          <div className="flex flex-wrap items-center justify-end gap-[6px]">
            <DecisionDialog
              id={`approve-${row.id}`}
              triggerLabel={REACTIVATION_TEXT.approve}
              title={REACTIVATION_TEXT.approveTitle}
              description={REACTIVATION_TEXT.approveBody}
              confirmLabel={REACTIVATION_TEXT.approveConfirm}
              reasonLabel={REACTIVATION_TEXT.noteLabel}
              reasonHint={REACTIVATION_TEXT.noteHint}
              primary
              optional
              size="sm"
              submit={approve.bind(null, row.id)}
            />
            <DecisionDialog
              id={`reject-${row.id}`}
              triggerLabel={REACTIVATION_TEXT.reject}
              title={REACTIVATION_TEXT.rejectTitle}
              description={REACTIVATION_TEXT.rejectBody}
              confirmLabel={REACTIVATION_TEXT.rejectConfirm}
              reasonLabel={REACTIVATION_TEXT.noteLabel}
              reasonHint={REACTIVATION_TEXT.noteHint}
              destructive
              optional
              size="sm"
              submit={reject.bind(null, row.id)}
            />
          </div>
        ) : (
          <div className="flex flex-col items-end gap-[4px]">
            <StatusTag tone={row.statusTone}>{row.statusLabel}</StatusTag>
            {row.adminNote ? (
              <span className="max-w-[36ch] text-[11px] ink-subtle">
                {REACTIVATION_TEXT.adminNote} {row.adminNote}
              </span>
            ) : null}
          </div>
        )}
      </td>
    </tr>
  );
}
