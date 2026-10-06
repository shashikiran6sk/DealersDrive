import { ENQUIRY_STATUS_LABELS, type AdminEnquiryDetail } from '@dealers-drive/contracts';

import { ENQUIRY_DETAIL_TEXT } from './enquiry-detail.constants';

export function EnquiryHistory({ history }: { history: AdminEnquiryDetail['history'] }) {
  return (
    <section aria-labelledby="enquiry-history-heading" className="card gap-[8px] bg-white p-4">
      <h2 id="enquiry-history-heading" className="text-[16px]">
        {ENQUIRY_DETAIL_TEXT.history}
      </h2>
      <p className="text-[12px] ink-subtle">{ENQUIRY_DETAIL_TEXT.historyIntro}</p>
      {history.length === 0 ? (
        <p className="text-[13px] ink-muted">{ENQUIRY_DETAIL_TEXT.noHistory}</p>
      ) : (
        <ol className="flex flex-col gap-[10px] border-l border-(--color-divider) pl-[14px]">
          {history.map((entry, index) => (
            <li key={`${entry.action}-${entry.at}-${String(index)}`} className="text-[13px]">
              <div className="font-medium">{entry.label}</div>
              <div className="text-[12px] ink-subtle">
                {entry.fromStatus && entry.toStatus
                  ? `${ENQUIRY_DETAIL_TEXT.transition(
                      ENQUIRY_STATUS_LABELS[entry.fromStatus],
                      ENQUIRY_STATUS_LABELS[entry.toStatus],
                    )} · `
                  : ''}
                {ENQUIRY_DETAIL_TEXT.by(entry.actor)} ·{' '}
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
