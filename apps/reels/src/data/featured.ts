import { formatLakh, type VehicleCardDto } from '@dealers-drive/contracts';

import { matchesTerm } from './models';
import { titleWithoutYear } from './specs';

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

export function sortByPrice(cards: readonly VehicleCardDto[]): VehicleCardDto[] {
  const rank = (card: VehicleCardDto) => priceRupees(card.priceLabel) ?? Number.POSITIVE_INFINITY;
  return [...cards].sort((a, b) => rank(a) - rank(b));
}

export function spreadByPrice(cards: readonly VehicleCardDto[], max: number): VehicleCardDto[] {
  const priced = sortByPrice(cards.filter((card) => priceRupees(card.priceLabel) !== null));
  const unpriced = cards.filter((card) => priceRupees(card.priceLabel) === null);

  if (priced.length >= max) {
    return spreadIndexes(priced.length, max).flatMap((index) => priced[index] ?? []);
  }
  return [...priced, ...unpriced.slice(0, max - priced.length)];
}

export type ModelSplit = {
  distinct: VehicleCardDto[];
  repeats: VehicleCardDto[];
};

export function splitByModel(
  cards: readonly VehicleCardDto[],
  keyOf: (card: VehicleCardDto) => string,
): ModelSplit {
  const newest = new Map<string, VehicleCardDto>();
  for (const card of cards) {
    const key = keyOf(card);
    const current = newest.get(key);
    if (current === undefined || (card.year ?? 0) > (current.year ?? 0)) newest.set(key, card);
  }
  const chosen = new Set(newest.values());
  return {
    distinct: cards.filter((card) => chosen.has(card)),
    repeats: cards.filter((card) => !chosen.has(card)),
  };
}

export function selectFeatured(
  cards: readonly VehicleCardDto[],
  max: number,
  keyOf: (card: VehicleCardDto) => string = (card) => card.slug,
): VehicleCardDto[] {
  const { distinct, repeats } = splitByModel(cards, keyOf);
  const chosen = spreadByPrice(distinct, max);
  const topUp = sortByPrice(repeats).slice(0, Math.max(0, max - chosen.length));
  return sortByPrice([...chosen, ...topUp]);
}

export function pickFeatured(
  cards: readonly VehicleCardDto[],
  terms: readonly string[],
  max: number,
): VehicleCardDto[] {
  if (terms.length > max) {
    throw new Error(`At most ${max} cars can be featured; ${terms.length} were named.`);
  }
  const used = new Set<string>();
  const picks = terms.map((term) => {
    const card = cards.find(
      (candidate) =>
        !used.has(candidate.slug) &&
        (candidate.slug === term ||
          matchesTerm(titleWithoutYear(candidate.title, candidate.year), term)),
    );
    if (card === undefined) {
      const titles = cards.map((candidate) => candidate.title).join(', ');
      throw new Error(`No available car with a photo matches "${term}". Available: ${titles}`);
    }
    used.add(card.slug);
    return card;
  });
  return sortByPrice(picks);
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
