import type { DeckEdge, DeckSpan } from './category-deck.types';

export function coverProgress(card: DeckEdge, next: Pick<DeckEdge, 'top'>): number {
  const covered = 1 - (next.top - card.top) / Math.max(1, card.height);
  return Math.min(1, Math.max(0, covered));
}

export function isBeside(card: Pick<DeckSpan, 'left'>, next: Pick<DeckSpan, 'left'>): boolean {
  return next.left - card.left > 1;
}

export function nearestToCentre(row: DeckSpan, cards: readonly DeckSpan[]): number {
  const centre = row.left + row.width / 2;
  let nearest = 0;
  let distance = Number.POSITIVE_INFINITY;
  cards.forEach((card, index) => {
    const away = Math.abs(card.left + card.width / 2 - centre);
    if (away < distance) {
      distance = away;
      nearest = index;
    }
  });
  return nearest;
}

export function headingId(key: string): string {
  return `home-category-${key}-heading`;
}
