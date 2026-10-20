export function clampIndex(index: number, total: number): number {
  if (total <= 0) return 0;
  return Math.max(0, Math.min(Math.round(index), total - 1));
}

export function indexFromOffset(offset: number, width: number, total: number): number {
  if (width <= 0) return 0;
  return clampIndex(offset / width, total);
}

export function steppedIndex(action: string, index: number, total: number): number | null {
  if (action === 'increment') return clampIndex(index + 1, total);
  if (action === 'decrement') return clampIndex(index - 1, total);
  return null;
}
