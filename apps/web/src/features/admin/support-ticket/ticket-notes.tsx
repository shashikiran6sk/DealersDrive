import type { AdminSupportTicketDetail } from '@dealers-drive/contracts';

import { SUPPORT_TICKET_TEXT } from './support-ticket.constants';

export function TicketNotes({ notes }: { notes: AdminSupportTicketDetail['notes'] }) {
  return (
    <section
      aria-labelledby="ticket-notes-heading"
      className="card gap-[8px] border-(--color-warn) bg-(--color-warn-bg) p-4"
    >
      <h2 id="ticket-notes-heading" className="text-[16px]">
        {SUPPORT_TICKET_TEXT.notes}
      </h2>
      <p className="text-[12px] text-(--color-warn)">{SUPPORT_TICKET_TEXT.notesIntro}</p>
      {notes.length === 0 ? (
        <p className="text-[13px] ink-muted">{SUPPORT_TICKET_TEXT.noNotes}</p>
      ) : (
        <ol className="m-0 flex list-none flex-col gap-[8px] p-0">
          {notes.map((entry) => (
            <li
              key={entry.id}
              className="rounded-[10px] border border-(--color-divider) bg-white px-[12px] py-[10px]"
            >
              <div className="text-[12px] ink-subtle">
                <span className="font-bold text-(--color-ink)">{entry.authorName}</span> ·{' '}
                <time dateTime={entry.createdAt} className="tnum">
                  {entry.createdLabel}
                </time>
              </div>
              <p className="m-0 mt-[4px] text-[13px] whitespace-pre-line [overflow-wrap:anywhere]">
                {entry.body}
              </p>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
