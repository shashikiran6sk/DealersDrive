import type { CSSProperties } from 'react';

import { DECK_TEXT } from './category-deck.constants';
import type { DeckProgressProps } from './category-deck.types';

export function DeckProgress({ current, total }: DeckProgressProps) {
  const style: CSSProperties = { transform: `scaleX(${String((current + 1) / total)})` };

  return (
    <div aria-hidden="true" data-deck-progress className="flex items-center gap-3.5 md:hidden">
      <span className="tnum min-w-[52px] font-mono text-[12px] ink-muted">
        {DECK_TEXT.position(current, total)}
      </span>
      <span className="h-[3px] flex-1 overflow-hidden rounded-full bg-(--color-divider)">
        <span
          style={style}
          className="block h-full origin-left bg-(--color-ink) transition-transform duration-300"
        />
      </span>
    </div>
  );
}
