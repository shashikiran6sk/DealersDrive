import type { AdminSupportTicketDetail } from '@dealers-drive/contracts';

import { SupportMessageBubble } from '@/features/support/support-requests';

import { SUPPORT_TICKET_TEXT } from './support-ticket.constants';

export function TicketConversation({ ticket }: { ticket: AdminSupportTicketDetail }) {
  return (
    <section aria-labelledby="ticket-conversation-heading" className="card gap-[10px] bg-white p-4">
      <div>
        <h2 id="ticket-conversation-heading" className="text-[16px]">
          {SUPPORT_TICKET_TEXT.conversation}
        </h2>
        <p className="text-[12px] ink-subtle">{SUPPORT_TICKET_TEXT.conversationIntro}</p>
      </div>
      <ol className="m-0 flex list-none flex-col gap-[10px] p-0">
        <SupportMessageBubble
          author="CUSTOMER"
          authorLabel={ticket.customer.name}
          tag={SUPPORT_TICKET_TEXT.original}
          body={ticket.description}
          createdAt={ticket.createdAt}
          createdLabel={ticket.createdLabel}
          side="start"
        />
        {ticket.messages.map((message) => (
          <SupportMessageBubble
            key={message.id}
            author={message.author}
            authorLabel={message.authorName}
            tag={message.author === 'SUPPORT' ? SUPPORT_TICKET_TEXT.supportTag : undefined}
            body={message.body}
            createdAt={message.createdAt}
            createdLabel={message.createdLabel}
            side={message.author === 'SUPPORT' ? 'end' : 'start'}
          />
        ))}
      </ol>
    </section>
  );
}
