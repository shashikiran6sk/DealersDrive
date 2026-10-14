import { countLabel } from '@/lib/plural';

export const PHOTO_GALLERY_TEXT = {
  label: 'Photographs',
  noPhotos: 'Photographs coming soon',
  viewOne: `${countLabel(1, 'photo')} · view`,
  viewAll: (index: number, total: number) => `${index + 1} / ${total} · view all`,
  openAll: (title: string, total: number) =>
    total === 1
      ? `View the photo of ${title}`
      : `View all ${countLabel(total, 'photo')} of ${title}`,
  openThumb: (index: number, total: number) => `Open photo ${index + 1} of ${total}`,
  scrollLeft: 'Scroll photos left',
  scrollRight: 'Scroll photos right',
  previous: 'Previous photo',
  next: 'Next photo',
  heroPrevious: 'Previous image',
  heroNext: 'Next image',
  close: 'Close',
  railLabel: 'All photos',
  railCell: (index: number, total: number) => `Photo ${index + 1} of ${total}`,
  count: (index: number, total: number) => `${index + 1} / ${total}`,
} as const;

export const PREVIOUS_GLYPH = '‹';
export const NEXT_GLYPH = '›';

export const STRIP_SCROLL_PX = 240;
export const RAIL_NUMBER_DIGITS = 2;

export const SWIPE_THRESHOLD_PX = 40;
export const SWIPE_CLICK_GUARD_MS = 500;

export const DEFAULT_STAGE_CLASS = 'aspect-[4/3]';

export const FALLBACK_SIZES = '(min-width: 1280px) 1232px, 100vw';
