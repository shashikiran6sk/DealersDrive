import type { AdminSupportTicketDetail } from '@dealers-drive/contracts';

import { SUPPORT_TICKET_TEXT } from './support-ticket.constants';

export function TicketHistory({ history }: { history: AdminSupportTicketDetail['history'] }) {
  return (
    <section aria-labelledby="ticket-history-heading" className="card gap-[8px] bg-white p-4">
      <h2 id="ticket-history-heading" className="text-[16px]">
        {SUPPORT_TICKET_TEXT.history}
      </h2>
      {history.length === 0 ? (
        <p className="text-[13px] ink-muted">{SUPPORT_TICKET_TEXT.noHistory}</p>
      ) : (
        <ol className="flex flex-col gap-[10px] border-l border-(--color-divider) pl-[14px]">
          {history.map((entry, index) => (
            <li key={`${entry.action}-${entry.at}-${String(index)}`} className="text-[13px]">
              <div className="font-medium">{entry.label}</div>
              <div className="text-[12px] ink-subtle">
                {entry.detail ? `${entry.detail} · ` : ''}
                {entry.actor} ·{' '}
                <time dateTime={entry.at} className="tnum">
                  {entry.atLabel}
                </time>
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
