import Link from 'next/link';

import { ButtonLink } from '@/components/ui/button';
import { LinkPendingLabel } from '@/components/ui/link-pending';
import { EmptyState, StatusTag } from '@/components/ui/primitives';

import {
  NEW_SUPPORT_REQUEST_PATH,
  SUPPORT_DETAIL_TEXT,
  SUPPORT_REQUESTS_PATH,
} from './support-requests.constants';
import type { SupportRequestDetailProps } from './support-requests.types';
import { SupportMessageBubble } from './support-message-bubble';
import { SupportReplyForm } from './support-reply-form';

function replyHint(status: SupportRequestDetailProps['ticket']['status']): string | null {
  if (status === 'RESOLVED') return SUPPORT_DETAIL_TEXT.resolvedNote;
  if (status === 'WAITING_FOR_CUSTOMER') return SUPPORT_DETAIL_TEXT.waitingNote;
  return null;
}

export function SupportRequestDetail({ ticket }: SupportRequestDetailProps) {
  return (
    <div className="flex flex-col gap-[18px]">
      <Link href={SUPPORT_REQUESTS_PATH} className="relative btn btn-ghost self-start">
        <LinkPendingLabel>{SUPPORT_DETAIL_TEXT.back}</LinkPendingLabel>
      </Link>

      <header className="flex flex-col gap-[8px]">
        <div className="flex flex-wrap items-center gap-[8px]">
          <span className="font-mono text-[13px] ink-subtle">{ticket.reference}</span>
          <StatusTag tone={ticket.statusTone}>{ticket.statusLabel}</StatusTag>
        </div>
        <h1 className="text-[24px] leading-[1.2] [overflow-wrap:anywhere] sm:text-[28px]">
          {ticket.subject}
        </h1>
        <dl className="grid grid-cols-1 gap-[6px] text-[13px] sm:grid-cols-3">
          <div>
            <dt className="text-[12px] ink-muted">{SUPPORT_DETAIL_TEXT.category}</dt>
            <dd className="m-0 font-medium">{ticket.categoryLabel}</dd>
          </div>
          <div>
            <dt className="text-[12px] ink-muted">{SUPPORT_DETAIL_TEXT.created}</dt>
            <dd className="m-0 font-medium tnum">{ticket.createdLabel}</dd>
          </div>
          <div>
            <dt className="text-[12px] ink-muted">{SUPPORT_DETAIL_TEXT.updated}</dt>
            <dd className="m-0 font-medium tnum">{ticket.updatedLabel}</dd>
          </div>
        </dl>
      </header>

      {ticket.enquiry ? (
        <section
          aria-labelledby="support-enquiry-heading"
          className="card flex flex-col gap-[6px] bg-white p-[16px]"
        >
          <h2 id="support-enquiry-heading" className="text-[12px] font-bold ink-muted">
            {SUPPORT_DETAIL_TEXT.enquiry}
          </h2>
          <div className="flex flex-wrap items-start justify-between gap-[8px]">
            <div className="min-w-0">
              <div className="text-[15px] font-extrabold">{ticket.enquiry.vehicleTitle}</div>
              <div className="text-[13px] ink-muted">
                {ticket.enquiry.dealerName} ·{' '}
                {SUPPORT_DETAIL_TEXT.enquirySent(ticket.enquiry.sentLabel)}
              </div>
            </div>
            <StatusTag tone="neutral">{ticket.enquiry.statusLabel}</StatusTag>
          </div>
          {ticket.enquiry.vehicleHref ? (
            <Link href={ticket.enquiry.vehicleHref} className="self-start text-[13px] font-bold">
              {SUPPORT_DETAIL_TEXT.viewCar}
            </Link>
          ) : null}
        </section>
      ) : null}

      <section aria-labelledby="support-conversation-heading" className="flex flex-col gap-[12px]">
        <h2 id="support-conversation-heading" className="text-[18px]">
          {SUPPORT_DETAIL_TEXT.conversation}
        </h2>
        <ol className="m-0 flex list-none flex-col gap-[10px] p-0">
          <SupportMessageBubble
            author="CUSTOMER"
            authorLabel={SUPPORT_DETAIL_TEXT.you}
            tag={SUPPORT_DETAIL_TEXT.original}
            body={ticket.description}
            createdAt={ticket.createdAt}
            createdLabel={ticket.createdLabel}
          />
          {ticket.messages.map((message) => (
            <SupportMessageBubble key={message.id} {...message} />
          ))}
        </ol>
        <p className="text-[11px] ink-subtle">{SUPPORT_DETAIL_TEXT.timesInIst}</p>
      </section>

      {ticket.canReply ? (
        <section className="card bg-white p-[16px]">
          <SupportReplyForm ticketId={ticket.id} hint={replyHint(ticket.status)} />
        </section>
      ) : (
        <EmptyState
          className="py-8"
          title={SUPPORT_DETAIL_TEXT.closedTitle}
          message={SUPPORT_DETAIL_TEXT.closedMessage}
          action={
            <ButtonLink href={NEW_SUPPORT_REQUEST_PATH} variant="primary">
              {SUPPORT_DETAIL_TEXT.newRequest}
            </ButtonLink>
          }
        />
      )}
    </div>
  );
}
