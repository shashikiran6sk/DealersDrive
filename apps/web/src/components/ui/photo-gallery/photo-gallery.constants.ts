import { countLabel } from '@/lib/plural';

import type { PhotoGalleryVariant } from './photo-gallery.types';

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
  zoomControls: 'Zoom',
  zoomIn: 'Zoom in',
  zoomOut: 'Zoom out',
} as const;

export const ZOOM_IN_GLYPH = '+';
export const ZOOM_OUT_GLYPH = '−';

export const PREVIOUS_GLYPH = '‹';
export const NEXT_GLYPH = '›';

export const STRIP_SCROLL_PX = 240;
export const RAIL_NUMBER_DIGITS = 2;

export const SWIPE_THRESHOLD_PX = 40;
export const SWIPE_CLICK_GUARD_MS = 500;

export const ZOOM = {
  min: 1,
  max: 4,
  step: 1.5,
  doubleTap: 2.5,
  settleBelow: 1.05,
  wheelSensitivity: 0.002,
  pinchWheelSensitivity: 0.01,
  wheelLinePx: 16,
  wheelPagePx: 800,
  keyPanPx: 80,
  tapSlopPx: 10,
  tapMs: 300,
  doubleTapMs: 300,
  doubleTapSlopPx: 30,
} as const;

export const ZOOM_IN_KEYS: readonly string[] = ['+', '='];
export const ZOOM_OUT_KEYS: readonly string[] = ['-', '_'];
export const ZOOM_RESET_KEY = '0';

export const DEFAULT_STAGE_CLASS = 'aspect-[4/3]';

export const STAGE_VARIANT_CLASS: Record<PhotoGalleryVariant, { stage: string; image: string }> = {
  cover: { stage: 'bg-(--color-surface)', image: 'object-cover' },
  studio: { stage: 'border-0 bg-(--color-page)', image: 'object-contain' },
};

export const STUDIO_BACKDROP = {
  level: 246,
  tolerance: 3,
  knee: 216,
  tableStep: 3,
  sampleEdge: 16,
  filterIdPrefix: 'dd-studio-white-',
} as const;

export const FALLBACK_SIZES = '(min-width: 1280px) 1232px, 100vw';
