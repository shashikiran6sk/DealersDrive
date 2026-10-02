import type { AdminEnquiryDetail } from '@dealers-drive/contracts';
import Link from 'next/link';

import { StatusTag } from '@/components/ui/primitives';

import { ENQUIRY_DETAIL_TEXT } from './enquiry-detail.constants';

export function EnquiryTickets({ tickets }: { tickets: AdminEnquiryDetail['supportTickets'] }) {
  return (
    <section aria-labelledby="enquiry-tickets-heading" className="card gap-[8px] bg-white p-4">
      <h2 id="enquiry-tickets-heading" className="text-[16px]">
        {ENQUIRY_DETAIL_TEXT.tickets}
      </h2>
      <p className="text-[12px] ink-subtle">{ENQUIRY_DETAIL_TEXT.ticketsIntro}</p>
      {tickets.length === 0 ? (
        <p className="text-[13px] ink-muted">{ENQUIRY_DETAIL_TEXT.noTickets}</p>
      ) : (
        <ul className="m-0 flex list-none flex-col gap-[8px] p-0">
          {tickets.map((ticket) => (
            <li key={ticket.id} className="flex flex-wrap items-center justify-between gap-[8px]">
              <Link href={`/admin/support/${ticket.id}`} className="min-w-0 text-[13px]">
                <span className="font-mono text-[11px] ink-subtle">{ticket.reference}</span>{' '}
                <span className="font-medium">{ticket.subject}</span>
              </Link>
              <StatusTag tone={ticket.statusTone}>{ticket.statusLabel}</StatusTag>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
