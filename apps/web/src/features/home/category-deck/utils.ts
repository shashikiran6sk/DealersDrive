import type { DeckEdge } from './category-deck.types';

export function coverProgress(card: DeckEdge, next: Pick<DeckEdge, 'top'>): number {
  const covered = 1 - (next.top - card.top) / Math.max(1, card.height);
  return Math.min(1, Math.max(0, covered));
}

export function headingId(key: string): string {
  return `home-category-${key}-heading`;
}
