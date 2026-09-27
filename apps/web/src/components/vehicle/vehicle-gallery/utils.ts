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

export function isTextEntry(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.isContentEditable ||
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement
  );
}
