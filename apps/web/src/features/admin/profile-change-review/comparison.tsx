import type { ReactNode } from 'react';

import { PROFILE_CHANGE_TEXT } from './profile-change-review.constants';

export interface ComparisonProps<T> {
  live: T;
  proposed: T | null;
  render: (value: T) => ReactNode;
}

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
