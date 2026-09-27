import { countLabel } from '@/lib/plural';

export const VEHICLE_GALLERY_TEXT = {
  label: 'Photographs',
  noPhotos: 'Photographs coming soon',
  viewAll: (total: number) =>
    total === 1
      ? `${countLabel(total, 'photo')} · view`
      : `${countLabel(total, 'photo')} · view all`,
  openAll: (title: string, total: number) =>
    total === 1
      ? `View the photo of ${title}`
      : `View all ${countLabel(total, 'photo')} of ${title}`,
  openThumb: (index: number, total: number) => `Open photo ${index + 1} of ${total}`,
  scrollLeft: 'Scroll photos left',
  scrollRight: 'Scroll photos right',
  previous: 'Previous photo',
  next: 'Next photo',
  close: 'Close',
  brand: 'DD',
  railLabel: 'All photos',
  railCell: (index: number, total: number) => `Photo ${index + 1} of ${total}`,
  count: (index: number, total: number) => `${index + 1} / ${total}`,
} as const;

export const PREVIOUS_GLYPH = '‹';
export const NEXT_GLYPH = '›';

export const STRIP_SCROLL_PX = 240;
export const RAIL_NUMBER_DIGITS = 2;
