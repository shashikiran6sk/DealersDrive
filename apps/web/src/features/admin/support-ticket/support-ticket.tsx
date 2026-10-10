'use client';

import type { AdminSupportTicketDetail } from '@dealers-drive/contracts';
import { useState } from 'react';
import Link from 'next/link';

import { LinkPendingLabel } from '@/components/ui/link-pending';
import { StatusTag } from '@/components/ui/primitives';
import { EnquiryVehicleCard } from '@/features/admin/enquiry-detail';

import { SUPPORT_TICKET_TEXT } from './support-ticket.constants';
import type { SupportTicketWorkspaceProps } from './support-ticket.types';
import { TicketComposer } from './ticket-composer';
import { TicketCustomer, TicketDealer, TicketEnquiry } from './ticket-context';
import { TicketControls } from './ticket-controls';
import { TicketConversation } from './ticket-conversation';
import { TicketHistory } from './ticket-history';
import { TicketNotes } from './ticket-notes';

export function SupportTicketWorkspace({
  ticket: initialTicket,
  viewerId,
}: SupportTicketWorkspaceProps) {
  const [savedTicket, setSavedTicket] = useState<AdminSupportTicketDetail | null>(null);
  const ticket =
    savedTicket &&
    savedTicket.id === initialTicket.id &&
    savedTicket.updatedAt > initialTicket.updatedAt
      ? savedTicket
      : initialTicket;
  return (
    <div className="mx-auto flex max-w-[1180px] flex-col gap-5 p-5">
      <Link href="/admin/support" className="relative btn btn-ghost self-start">
        <LinkPendingLabel>{SUPPORT_TICKET_TEXT.back}</LinkPendingLabel>
      </Link>

      <header className="flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="font-mono text-[13px] ink-subtle">{ticket.reference}</div>
          <h1 className="text-[24px] leading-[1.15] [overflow-wrap:anywhere]">{ticket.subject}</h1>
          <p className="mt-1 text-[13px] ink-muted tnum">
            {ticket.categoryLabel} · {SUPPORT_TICKET_TEXT.created(ticket.createdLabel)} ·{' '}
            {SUPPORT_TICKET_TEXT.updated(ticket.updatedLabel)}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <StatusTag tone={ticket.priorityTone}>{ticket.priorityLabel}</StatusTag>
          <StatusTag tone={ticket.statusTone}>{ticket.statusLabel}</StatusTag>
        </div>
      </header>

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex min-w-0 flex-col gap-5">
          <TicketConversation ticket={ticket} />
          <TicketComposer
            key={ticket.id}
            ticketId={ticket.id}
            canReply={ticket.canReply}
            onSaved={setSavedTicket}
          />
          <TicketNotes notes={ticket.notes} />
          <TicketHistory history={ticket.history} />
        </div>

        <aside className="flex min-w-0 flex-col gap-5">
          <section
            aria-labelledby="ticket-controls-heading"
            className="card gap-[10px] bg-white p-4"
          >
            <h2 id="ticket-controls-heading" className="text-[16px]">
              {SUPPORT_TICKET_TEXT.controls}
            </h2>
            <TicketControls ticket={ticket} viewerId={viewerId} />
            {ticket.resolvedLabel ? (
              <p className="text-[12px] ink-subtle">
                {SUPPORT_TICKET_TEXT.resolvedOn(ticket.resolvedLabel)}
              </p>
            ) : null}
            {ticket.closedLabel ? (
              <p className="text-[12px] ink-subtle">
                {SUPPORT_TICKET_TEXT.closedOn(ticket.closedLabel)}
              </p>
            ) : null}
          </section>
          <TicketCustomer customer={ticket.customer} />
          <TicketEnquiry enquiry={ticket.enquiry} />
          {ticket.vehicle ? <EnquiryVehicleCard vehicle={ticket.vehicle} /> : null}
          {ticket.dealer ? <TicketDealer dealer={ticket.dealer} /> : null}
          <p className="text-[11px] ink-subtle">{SUPPORT_TICKET_TEXT.timesInIst}</p>
        </aside>
      </div>
    </div>
  );
}
