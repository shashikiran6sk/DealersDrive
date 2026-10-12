import { DOC_CATEGORY_LABELS, DOC_TYPE_LABELS } from '@dealers-drive/contracts';

import { StatusTag } from '@/components/ui/primitives';
import { formatIstDateTime } from '@/lib/dates';

import {
  DOCUMENT_REVIEW_TEXT,
  HISTORY_ACTION_LABELS,
  HISTORY_TONE,
} from './document-review.constants';
import type { DocumentHistoryEntry } from './document-review.types';

function subjectOf(entry: DocumentHistoryEntry): string {
  if (entry.type) return DOC_TYPE_LABELS[entry.type];
  if (entry.category) return DOC_CATEGORY_LABELS[entry.category];
  return DOCUMENT_REVIEW_TEXT.unknownDocument;
}

export function DocumentHistory({ history }: { history: readonly DocumentHistoryEntry[] }) {
  return (
    <details className="mt-3 border-t border-(--color-divider) pt-3 text-[13px]">
      <summary className="cursor-pointer font-medium">
        {DOCUMENT_REVIEW_TEXT.historyHeading(history.length)}
      </summary>
      {history.length === 0 ? (
        <p className="py-2 text-[12px] ink-muted">{DOCUMENT_REVIEW_TEXT.historyEmpty}</p>
      ) : (
        <ol className="mt-2 flex flex-col">
          {history.map((entry, index) => (
            <li
              key={`${entry.at}-${String(index)}`}
              className="flex flex-col gap-1 border-b border-(--color-divider) py-[7px] last:border-b-0"
            >
              <div className="flex flex-wrap items-center gap-2">
                <StatusTag tone={HISTORY_TONE[entry.action]}>
                  {HISTORY_ACTION_LABELS[entry.action]}
                </StatusTag>
                <span className="min-w-0 flex-1">{subjectOf(entry)}</span>
                <span className="whitespace-nowrap text-[11px] ink-faint tnum">
                  {formatIstDateTime(entry.at)} · {DOCUMENT_REVIEW_TEXT.historyBy(entry.actorType)}
                </span>
              </div>
              {entry.reason ? <p className="text-[12px] ink-muted">{entry.reason}</p> : null}
            </li>
          ))}
        </ol>
      )}
    </details>
  );
}
