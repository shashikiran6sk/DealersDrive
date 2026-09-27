import { cn } from '@/lib/cn';

import { NEXT_GLYPH, PREVIOUS_GLYPH } from './vehicle-gallery.constants';

export type GalleryArrowPlacement = 'strip' | 'stage';

export interface GalleryArrowProps {
  direction: 'previous' | 'next';
  label: string;
  onClick: () => void;
  placement: GalleryArrowPlacement;
  disabled?: boolean;
}

const PLACEMENT_CLASS: Record<
  GalleryArrowPlacement,
  { base: string; previous: string; next: string }
> = {
  strip: { base: 'max-md:h-11 max-md:w-11', previous: 'left-0', next: 'right-0' },
  stage: {
    base: 'h-[38px] w-[38px] bg-white/90 max-md:h-11 max-md:w-11',
    previous: 'left-[14px] max-md:left-[6px]',
    next: 'right-[14px] max-md:right-[6px]',
  },
};

export function GalleryArrow({
  direction,
  label,
  onClick,
  placement,
  disabled,
}: GalleryArrowProps) {
  const classes = PLACEMENT_CLASS[placement];
  const previous = direction === 'previous';

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className={cn('dd-arrow', classes.base, previous ? classes.previous : classes.next)}
    >
      <span aria-hidden="true">{previous ? PREVIOUS_GLYPH : NEXT_GLYPH}</span>
    </button>
  );
}
