import { RAIL_NUMBER_DIGITS, STUDIO_BACKDROP, SWIPE_THRESHOLD_PX } from './photo-gallery.constants';
import type { GalleryPhoto, GalleryStep, PhotoKind } from './photo-gallery.types';

export function wrapIndex(index: number, total: number): number {
  if (total <= 0) return 0;
  return ((index % total) + total) % total;
}

export function initialIndex(requested: number, total: number): number {
  return Number.isInteger(requested) && requested >= 0 && requested < total ? requested : 0;
}

export function arrowStep(key: string): GalleryStep | null {
  if (key === 'ArrowLeft') return -1;
  if (key === 'ArrowRight') return 1;
  return null;
}

export interface StripMetrics {
  scrollLeft: number;
  clientWidth: number;
  scrollWidth: number;
}

export function stripEdges({ scrollLeft, clientWidth, scrollWidth }: StripMetrics): {
  atStart: boolean;
  atEnd: boolean;
} {
  return {
    atStart: scrollLeft <= 1,
    atEnd: scrollLeft + clientWidth >= scrollWidth - 1,
  };
}

export function railNumber(index: number): string {
  return String(index + 1).padStart(RAIL_NUMBER_DIGITS, '0');
}

export interface Span {
  left: number;
  right: number;
}

export function revealOffset(track: Span, thumb: Span): number {
  if (thumb.left < track.left) return thumb.left - track.left;
  if (thumb.right > track.right) return thumb.right - track.right;
  return 0;
}

export function swipeStep(
  deltaX: number,
  deltaY: number,
  threshold: number = SWIPE_THRESHOLD_PX,
): GalleryStep | null {
  if (Math.abs(deltaX) < threshold || Math.abs(deltaX) <= Math.abs(deltaY)) return null;
  return deltaX < 0 ? 1 : -1;
}

export function captionOf(photo: GalleryPhoto): string {
  return photo.caption?.trim() || photo.alt;
}

const CHANNEL_MAX = 255;

export function studioWhiteLevel(level: number): number {
  const { level: backdrop, knee } = STUDIO_BACKDROP;
  if (level <= knee) return level;
  if (level >= backdrop) return CHANNEL_MAX;
  return knee + ((level - knee) * (CHANNEL_MAX - knee)) / (backdrop - knee);
}

export function studioWhiteTable(): string {
  const { tableStep } = STUDIO_BACKDROP;
  const values: string[] = [];
  for (let level = 0; level <= CHANNEL_MAX; level += tableStep) {
    values.push(String(Number((studioWhiteLevel(level) / CHANNEL_MAX).toFixed(4))));
  }
  return values.join(' ');
}

export function isStudioBackdrop(rgba: ArrayLike<number>): boolean {
  const { level, tolerance } = STUDIO_BACKDROP;
  for (let offset = 0; offset + 2 < rgba.length; offset += 4) {
    for (let channel = 0; channel < 3; channel += 1) {
      const value = rgba[offset + channel];
      if (value === undefined || Math.abs(value - level) > tolerance) return false;
    }
  }
  return rgba.length >= 4;
}

export function cornerKind(rgba: ArrayLike<number>, edge: number): PhotoKind {
  const last = edge - 1;
  const corners = [0, last, last * edge, last * edge + last].flatMap((pixel) =>
    Array.from({ length: 4 }, (_, channel) => rgba[pixel * 4 + channel] ?? -1),
  );
  return isStudioBackdrop(corners) ? 'studio' : 'photo';
}

export function studioFilterId(reactId: string): string {
  return `${STUDIO_BACKDROP.filterIdPrefix}${reactId.replace(/[^A-Za-z0-9_-]/g, '')}`;
}
