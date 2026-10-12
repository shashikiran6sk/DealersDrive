import {
  DEALER_VERIFICATION_LABELS,
  type DealerVerificationReview,
} from '@dealers-drive/contracts';

import { DATE_LOCALE, DEALER_VERIFICATION_TEXT } from './dealer-verification.constants';

export function VerificationHistory({ history }: { history: DealerVerificationReview['history'] }) {
  return (
    <div>
      <h3 className="text-[16px]">{DEALER_VERIFICATION_TEXT.historyHeading}</h3>
      <p className="text-[12px] ink-muted">{DEALER_VERIFICATION_TEXT.historyNote}</p>
      {history.length === 0 ? (
        <p className="text-[13px] ink-muted">{DEALER_VERIFICATION_TEXT.noHistory}</p>
      ) : (
        <ol className="flex list-none flex-col gap-3 p-0">
          {history.map((event) => (
            <li
              key={event.id}
              className="border-t border-(--color-divider) pt-3 text-[13px] [overflow-wrap:anywhere]"
            >
              <p>
                {DEALER_VERIFICATION_LABELS[event.from]} → {DEALER_VERIFICATION_LABELS[event.to]}
              </p>
              <p className="ink-muted">
                {new Date(event.at).toLocaleString(DATE_LOCALE)} ·{' '}
                {DEALER_VERIFICATION_TEXT.actor(event.actorId)}
              </p>
              {event.reason ? <p>{event.reason}</p> : null}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
