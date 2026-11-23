import type { StockFigure } from '../reel/reel.types';

export const ROUNDING_FROM = 10;
export const ROUNDING_STEP = 5;

export function stockFigure(available: number): StockFigure {
  if (available < ROUNDING_FROM) return { value: available, plus: false };
  const value = Math.floor(available / ROUNDING_STEP) * ROUNDING_STEP;
  return { value, plus: value < available };
}
