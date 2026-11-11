import { cn } from '@/lib/cn';

import type { DeckArrowProps } from './category-deck.types';

export function DeckArrow({ label, disabled, flipped = false, onClick }: DeckArrowProps) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="grid size-9 place-items-center rounded-full border border-(--color-divider) bg-white text-(--color-ink) transition-transform duration-150 active:scale-90 disabled:opacity-35"
    >
      <svg
        viewBox="0 0 16 16"
        aria-hidden="true"
        className={cn('size-4 fill-none stroke-current', flipped && 'rotate-180')}
      >
        <path
          d="M3 8h10M9 4l4 4-4 4"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}
