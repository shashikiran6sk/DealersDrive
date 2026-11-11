import type { CSSProperties } from 'react';

import { DECK_TEXT } from './category-deck.constants';
import type { DeckProgressProps } from './category-deck.types';
import { DeckArrow } from './deck-arrow';

export function DeckProgress({ current, total, onStep }: DeckProgressProps) {
  const style: CSSProperties = { transform: `scaleX(${String((current + 1) / total)})` };

  return (
    <div data-deck-progress className="flex items-center gap-3 md:hidden">
      <span aria-hidden="true" className="tnum font-mono text-[12px] ink-muted">
        {DECK_TEXT.position(current, total)}
      </span>
      <span
        aria-hidden="true"
        className="h-[3px] flex-1 overflow-hidden rounded-full bg-(--color-divider)"
      >
        <span
          style={style}
          className="block h-full origin-left bg-(--color-ink) transition-transform duration-300"
        />
      </span>
      {onStep ? (
        <>
          <span aria-hidden="true" className="dd-swipe-hint text-[12px] font-bold ink-secondary">
            {DECK_TEXT.swipe}
          </span>
          <DeckArrow
            label={DECK_TEXT.previous}
            disabled={current === 0}
            flipped
            onClick={() => onStep(-1)}
          />
          <DeckArrow
            label={DECK_TEXT.next}
            disabled={current >= total - 1}
            onClick={() => onStep(1)}
          />
        </>
      ) : null}
    </div>
  );
}
