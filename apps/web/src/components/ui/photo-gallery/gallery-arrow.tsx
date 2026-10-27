import { cn } from '@/lib/cn';

import { GalleryChevron } from './gallery-chevron';

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
  { base: string; icon: string; previous: string; next: string }
> = {
  strip: { base: 'max-md:h-11 max-md:w-11', icon: 'size-4', previous: 'left-0', next: 'right-0' },
  stage: {
    base: 'h-10 w-10 border-(--color-neutral-400) shadow-[0_2px_8px_rgb(20_20_18/0.14)] enabled:hover:border-(--color-neutral-500) max-md:h-11 max-md:w-11',
    icon: 'size-5',
    previous: 'left-[12px] max-md:left-[8px]',
    next: 'right-[12px] max-md:right-[8px]',
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
      <GalleryChevron direction={direction} className={classes.icon} />
    </button>
  );
}
