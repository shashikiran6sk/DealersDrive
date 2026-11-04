import { formatLakh, type VehicleCardDto } from '@dealers-drive/contracts';

const PAISE_PER_RUPEE = 100;

export function priceRupees(label: string | null): number | null {
  if (label === null) return null;
  const digits = label.replace(/[^\d]/g, '');
  if (digits.length === 0) return null;
  const rupees = Number(digits);
  return rupees > 0 ? rupees : null;
}

export function showcaseCars(cards: readonly VehicleCardDto[]): VehicleCardDto[] {
  return cards.filter((card) => card.availability === 'AVAILABLE' && card.image !== null);
}

export function spreadIndexes(length: number, count: number): number[] {
  if (length <= 0 || count <= 0) return [];
  if (count === 1) return [length - 1];
  if (length <= count) return Array.from({ length }, (_, index) => index);
  const picks = new Set<number>();
  for (let step = 0; step < count; step += 1) {
    picks.add(Math.round((step * (length - 1)) / (count - 1)));
  }
  return [...picks].sort((a, b) => a - b);
}

export function selectFeatured(cards: readonly VehicleCardDto[], max: number): VehicleCardDto[] {
  const priced = cards
    .map((card) => ({ card, rupees: priceRupees(card.priceLabel) }))
    .filter((entry): entry is { card: VehicleCardDto; rupees: number } => entry.rupees !== null)
    .sort((a, b) => a.rupees - b.rupees)
    .map((entry) => entry.card);
  const unpriced = cards.filter((card) => priceRupees(card.priceLabel) === null);

  if (priced.length >= max) {
    return spreadIndexes(priced.length, max).flatMap((index) => priced[index] ?? []);
  }
  return [...priced, ...unpriced.slice(0, max - priced.length)];
}

export function selectGallery(
  cards: readonly VehicleCardDto[],
  featured: readonly VehicleCardDto[],
  max: number,
): VehicleCardDto[] {
  const featuredSlugs = new Set(featured.map((card) => card.slug));
  const others = cards.filter((card) => !featuredSlugs.has(card.slug));
  return [...others, ...featured].slice(0, max);
}

export function priceRange(cards: readonly VehicleCardDto[]): string | null {
  const prices = cards
    .map((card) => priceRupees(card.priceLabel))
    .filter((rupees): rupees is number => rupees !== null);
  if (prices.length === 0) return null;

  const low = formatLakh(Math.min(...prices) * PAISE_PER_RUPEE);
  const high = formatLakh(Math.max(...prices) * PAISE_PER_RUPEE);
  return low === high ? low : `${low} – ${high}`;
}
