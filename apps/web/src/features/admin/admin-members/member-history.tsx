import type { AdminMemberHistoryEntry } from '@dealers-drive/contracts';

import { formatDateTime } from './utils';

export interface MemberHistoryProps {
  entries: AdminMemberHistoryEntry[];
  emptyLabel: string;
}

export function MemberHistory({ entries, emptyLabel }: MemberHistoryProps) {
  if (entries.length === 0) return <p className="text-[13px] ink-muted">{emptyLabel}</p>;

  return (
    <ol className="flex flex-col gap-2">
      {entries.map((entry) => (
        <li
          key={entry.id}
          className="flex flex-wrap items-baseline gap-x-3 gap-y-1 rounded-[10px] border border-(--color-divider) bg-white px-4 py-3"
        >
          <span className="text-[13px] font-semibold">{entry.label}</span>
          {entry.detail ? <span className="text-[13px] ink-body">{entry.detail}</span> : null}
          <span className="ml-auto text-[12px] ink-muted">
            {entry.actorEmail ? `${entry.actorEmail} · ` : ''}
            <time dateTime={entry.at}>{formatDateTime(entry.at)}</time>
          </span>
        </li>
      ))}
    </ol>
  );
}
