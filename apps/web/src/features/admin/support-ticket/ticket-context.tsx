import type { AdminSupportTicketDetail } from '@dealers-drive/contracts';
import Link from 'next/link';

import { LinkPendingLabel } from '@/components/ui/link-pending';
import { StatusTag } from '@/components/ui/primitives';
import { DetailRow } from '@/features/admin/enquiry-detail';

import { SUPPORT_TICKET_TEXT } from './support-ticket.constants';

export function TicketCustomer({ customer }: { customer: AdminSupportTicketDetail['customer'] }) {
  return (
    <section aria-labelledby="ticket-customer-heading" className="card gap-[8px] bg-white p-4">
      <h2 id="ticket-customer-heading" className="text-[16px]">
        {SUPPORT_TICKET_TEXT.customer}
      </h2>
      <dl>
        <DetailRow label={SUPPORT_TICKET_TEXT.name}>{customer.name}</DetailRow>
        <DetailRow label={SUPPORT_TICKET_TEXT.mobile}>
          {customer.phoneDisplay ? (
            <span className="inline-flex flex-wrap items-center justify-end gap-[6px]">
              <span className="font-mono">{customer.phoneDisplay}</span>
              <StatusTag tone="ok">{SUPPORT_TICKET_TEXT.verified}</StatusTag>
            </span>
          ) : (
            <span className="ink-faint">{SUPPORT_TICKET_TEXT.noNumber}</span>
          )}
        </DetailRow>
        <DetailRow label={SUPPORT_TICKET_TEXT.memberSince}>{customer.memberSinceLabel}</DetailRow>
        <DetailRow label={SUPPORT_TICKET_TEXT.requests}>
          {SUPPORT_TICKET_TEXT.ticketCount(customer.ticketCount)}
        </DetailRow>
      </dl>
    </section>
  );
}

export function TicketEnquiry({ enquiry }: { enquiry: AdminSupportTicketDetail['enquiry'] }) {
  return (
    <section aria-labelledby="ticket-enquiry-heading" className="card gap-[8px] bg-white p-4">
      <h2 id="ticket-enquiry-heading" className="text-[16px]">
        {SUPPORT_TICKET_TEXT.enquiry}
      </h2>
      {enquiry ? (
        <>
          <dl>
            <DetailRow label={SUPPORT_TICKET_TEXT.enquiryStatus}>
              <StatusTag tone={enquiry.statusTone}>{enquiry.statusLabel}</StatusTag>
            </DetailRow>
            <DetailRow label={SUPPORT_TICKET_TEXT.customerSees}>
              {enquiry.customerStatusLabel}
            </DetailRow>
            <DetailRow label={SUPPORT_TICKET_TEXT.enquirySent}>{enquiry.sentLabel}</DetailRow>
          </dl>
          <div>
            <div className="text-[12px] ink-muted">{SUPPORT_TICKET_TEXT.enquiryMessage}</div>
            <p className="m-0 mt-[2px] text-[13px] whitespace-pre-line [overflow-wrap:anywhere]">
              {enquiry.message ?? (
                <span className="ink-subtle">{SUPPORT_TICKET_TEXT.noEnquiryMessage}</span>
              )}
            </p>
          </div>
          <Link
            href={enquiry.adminHref}
            className="relative btn btn-secondary self-start text-[12px]"
          >
            <LinkPendingLabel>{SUPPORT_TICKET_TEXT.openEnquiry}</LinkPendingLabel>
          </Link>
        </>
      ) : (
        <p className="text-[13px] ink-muted">{SUPPORT_TICKET_TEXT.noEnquiry}</p>
      )}
    </section>
  );
}

export function TicketDealer({
  dealer,
}: {
  dealer: NonNullable<AdminSupportTicketDetail['dealer']>;
}) {
  return (
    <section aria-labelledby="ticket-dealer-heading" className="card gap-[8px] bg-white p-4">
      <h2 id="ticket-dealer-heading" className="text-[16px]">
        {SUPPORT_TICKET_TEXT.dealer}
      </h2>
      <dl>
        <DetailRow label={SUPPORT_TICKET_TEXT.name}>{dealer.name}</DetailRow>
        <DetailRow label={SUPPORT_TICKET_TEXT.dealerStatus}>
          <StatusTag tone={dealer.statusTone}>{dealer.statusLabel}</StatusTag>
        </DetailRow>
        <DetailRow label={SUPPORT_TICKET_TEXT.dealerPhone}>
          {dealer.phoneDisplay ? (
            <span className="font-mono">{dealer.phoneDisplay}</span>
          ) : (
            <span className="ink-faint">{SUPPORT_TICKET_TEXT.notEntered}</span>
          )}
        </DetailRow>
      </dl>
      <Link href={dealer.adminHref} className="relative btn btn-secondary self-start text-[12px]">
        <LinkPendingLabel>{SUPPORT_TICKET_TEXT.openDealer}</LinkPendingLabel>
      </Link>
    </section>
  );
}
