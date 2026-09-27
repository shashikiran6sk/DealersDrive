import { RAIL_NUMBER_DIGITS } from './vehicle-gallery.constants';

export function wrapIndex(index: number, total: number): number {
  if (total <= 0) return 0;
  return ((index % total) + total) % total;
}

export function startIndex(primaryIndex: number, total: number): number {
  return primaryIndex >= 0 && primaryIndex < total ? primaryIndex : 0;
}

export function arrowStep(key: string): -1 | 1 | null {
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
