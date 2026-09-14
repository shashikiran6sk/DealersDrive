import type { ReactNode } from 'react';

import { PROFILE_CHANGE_TEXT } from './profile-change-review.constants';

export interface ComparisonProps<T> {
  live: T;
  proposed: T | null;
  render: (value: T) => ReactNode;
}

/**
 * Now, and what it would become.
 *
 * `proposed === null` is the case worth the branch: it means *this request does
 * not touch this field*, and it has to read as **unchanged** rather than as
 * cleared. Rendering an empty row would tell the moderator the dealer wants
 * their services removed, and approving that reading would be approving
 * something nobody asked for.
 */
export function Comparison<T>({ live, proposed, render }: ComparisonProps<T>) {
  if (proposed === null) {
    return (
      <div className="flex items-baseline gap-2">
        {render(live)}
        <span className="text-[11px] ink-faint">{PROFILE_CHANGE_TEXT.unchanged}</span>
      </div>
    );
  }

  return (
    <div className="grid gap-[10px] sm:grid-cols-2">
      <div>
        <div className="mb-[4px] text-[11px] ink-muted">{PROFILE_CHANGE_TEXT.liveNow}</div>
        <div className="ink-muted line-through decoration-1">{render(live)}</div>
      </div>
      <div>
        <div className="mb-[4px] text-[11px] font-semibold text-(--color-accent)">
          {PROFILE_CHANGE_TEXT.proposed}
        </div>
        <div className="font-medium">{render(proposed)}</div>
      </div>
    </div>
  );
}
