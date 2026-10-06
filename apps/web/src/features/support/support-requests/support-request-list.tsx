import Link from 'next/link';

import { ButtonLink } from '@/components/ui/button';
import { LinkPendingLabel } from '@/components/ui/link-pending';
import { EmptyState } from '@/components/ui/primitives';

import { NEW_SUPPORT_REQUEST_PATH, SUPPORT_REQUESTS_TEXT } from './support-requests.constants';
import type { SupportRequestListProps } from './support-requests.types';
import { SupportRequestRow } from './support-request-row';
import { supportRequestsHref } from './utils';

export function SupportRequestList({ tickets }: SupportRequestListProps) {
  return (
    <div className="flex flex-col gap-[16px]">
      <div className="flex flex-wrap items-end justify-between gap-[12px]">
        <div className="min-w-0 flex-1">
          <h1 className="text-[26px] sm:text-[30px]">{SUPPORT_REQUESTS_TEXT.title}</h1>
          <p className="mt-[6px] max-w-[60ch] text-[14px] ink-muted">
            {SUPPORT_REQUESTS_TEXT.intro}
          </p>
        </div>
        {tickets.data.length > 0 ? (
          <ButtonLink href={NEW_SUPPORT_REQUEST_PATH} variant="primary" className="max-sm:w-full">
            {SUPPORT_REQUESTS_TEXT.create}
          </ButtonLink>
        ) : null}
      </div>

      {tickets.data.length === 0 ? (
        <EmptyState
          title={SUPPORT_REQUESTS_TEXT.emptyTitle}
          message={SUPPORT_REQUESTS_TEXT.emptyMessage}
          action={
            <ButtonLink href={NEW_SUPPORT_REQUEST_PATH} variant="primary">
              {SUPPORT_REQUESTS_TEXT.create}
            </ButtonLink>
          }
        />
      ) : (
        <ul
          aria-label={SUPPORT_REQUESTS_TEXT.listLabel}
          className="m-0 flex list-none flex-col gap-[10px] p-0"
        >
          {tickets.data.map((ticket) => (
            <SupportRequestRow key={ticket.id} ticket={ticket} />
          ))}
        </ul>
      )}

      {tickets.page.nextCursor ? (
        <Link
          href={supportRequestsHref(tickets.page.nextCursor)}
          className="relative btn btn-secondary self-center"
        >
          <LinkPendingLabel>{SUPPORT_REQUESTS_TEXT.more}</LinkPendingLabel>
        </Link>
      ) : null}

      <p className="text-[13px] ink-muted">
        {SUPPORT_REQUESTS_TEXT.otherWays}{' '}
        <Link href={SUPPORT_REQUESTS_TEXT.contactHref} className="font-bold text-(--color-ink)">
          {SUPPORT_REQUESTS_TEXT.contactLink}
        </Link>
      </p>
    </div>
  );
}
