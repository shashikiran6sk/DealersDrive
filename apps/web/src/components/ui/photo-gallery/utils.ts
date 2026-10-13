import { RAIL_NUMBER_DIGITS, SWIPE_THRESHOLD_PX } from './photo-gallery.constants';
import type { GalleryPhoto, GalleryStep } from './photo-gallery.types';

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
