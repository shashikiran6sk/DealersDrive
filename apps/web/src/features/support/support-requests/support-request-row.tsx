import Link from 'next/link';

import { StatusTag } from '@/components/ui/primitives';

import { SUPPORT_REQUESTS_TEXT } from './support-requests.constants';
import type { SupportRequestRowProps } from './support-requests.types';
import { supportRequestHref } from './utils';

export function SupportRequestRow({ ticket }: SupportRequestRowProps) {
  return (
    <li>
      <Link
        href={supportRequestHref(ticket.id)}
        className="card flex flex-col gap-[8px] bg-white p-[16px] text-(--color-ink) no-underline transition-colors hover:border-(--color-neutral-400) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--color-focus)"
      >
        <div className="flex flex-wrap items-start justify-between gap-[8px]">
          <div className="min-w-0 flex-1">
            <div className="font-mono text-[12px] ink-subtle">{ticket.reference}</div>
            <div className="text-[16px] font-extrabold [overflow-wrap:anywhere]">
              {ticket.subject}
            </div>
          </div>
          <StatusTag tone={ticket.statusTone}>{ticket.statusLabel}</StatusTag>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-x-[12px] gap-y-[4px] border-t border-(--color-divider) pt-[8px] text-[12px] ink-muted">
          <span>{ticket.categoryLabel}</span>
          <time dateTime={ticket.updatedAt} className="tnum">
            {SUPPORT_REQUESTS_TEXT.updated(ticket.updatedLabel)}
          </time>
        </div>
      </Link>
    </li>
  );
}
