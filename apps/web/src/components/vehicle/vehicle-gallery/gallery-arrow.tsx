import { cn } from '@/lib/cn';

import { NEXT_GLYPH, PREVIOUS_GLYPH, VEHICLE_GALLERY_TEXT } from './vehicle-gallery.constants';

export interface GalleryArrowProps {
  direction: 'previous' | 'next';
  onClick: () => void;
  size?: 'md' | 'lg';
}

export function GalleryArrow({ direction, onClick, size = 'md' }: GalleryArrowProps) {
  const previous = direction === 'previous';

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={previous ? VEHICLE_GALLERY_TEXT.previous : VEHICLE_GALLERY_TEXT.next}
      className={cn(
        'absolute top-1/2 z-[3] grid -translate-y-1/2 place-items-center border border-(--color-divider) bg-white/90 text-(--color-ink) shadow-md',
        'transition-colors hover:border-(--color-accent) hover:bg-(--color-accent) hover:text-white',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--color-accent)',
        size === 'lg' ? 'h-11 w-11 text-[30px] leading-none' : 'h-10 w-10 text-[26px] leading-none',
        previous
          ? size === 'lg'
            ? 'left-[14px]'
            : 'left-[10px]'
          : size === 'lg'
            ? 'right-[14px]'
            : 'right-[10px]',
      )}
    >
      <span aria-hidden="true">{previous ? PREVIOUS_GLYPH : NEXT_GLYPH}</span>
    </button>
  );
}
