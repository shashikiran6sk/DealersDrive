import type { BodyType, FuelType, Transmission } from '@prisma/client';

export interface SimilarTraits {
  id: string;
  make: string | null;
  model: string | null;
  bodyType: BodyType | null;
  fuelType: FuelType | null;
  transmission: Transmission | null;
  manufacturingYear: number | null;
  pricePaise: bigint | null;
  district: string | null;
  publishedAt: Date | null;
}

export const SIMILARITY_WEIGHTS = {
  sameModel: 4,
  sameMake: 3,
  sameBodyType: 3,
  sameDistrict: 2,
  closePrice: 2,
  sameFuel: 1,
  sameTransmission: 1,
  closeYear: 1,
} as const;

export const PRICE_BAND = 0.2;

export const YEAR_BAND = 2;

export const POOL_PRICE_BAND = 0.35;

function same<T>(a: T | null, b: T | null): boolean {
  return a !== null && b !== null && a === b;
}

function sameText(a: string | null, b: string | null): boolean {
  return a !== null && b !== null && a.toLowerCase() === b.toLowerCase();
}

export function priceGap(a: bigint | null, b: bigint | null): number | null {
  if (a === null || b === null || a <= 0n) return null;
  return Math.abs(Number(b - a)) / Number(a);
}

export function similarityScore(source: SimilarTraits, candidate: SimilarTraits): number {
  const gap = priceGap(source.pricePaise, candidate.pricePaise);
  const years =
    source.manufacturingYear === null || candidate.manufacturingYear === null
      ? null
      : Math.abs(source.manufacturingYear - candidate.manufacturingYear);
  const sameMake = sameText(source.make, candidate.make);

  return (
    (sameMake && sameText(source.model, candidate.model) ? SIMILARITY_WEIGHTS.sameModel : 0) +
    (sameMake ? SIMILARITY_WEIGHTS.sameMake : 0) +
    (same(source.bodyType, candidate.bodyType) ? SIMILARITY_WEIGHTS.sameBodyType : 0) +
    (sameText(source.district, candidate.district) ? SIMILARITY_WEIGHTS.sameDistrict : 0) +
    (gap !== null && gap <= PRICE_BAND ? SIMILARITY_WEIGHTS.closePrice : 0) +
    (same(source.fuelType, candidate.fuelType) ? SIMILARITY_WEIGHTS.sameFuel : 0) +
    (same(source.transmission, candidate.transmission) ? SIMILARITY_WEIGHTS.sameTransmission : 0) +
    (years !== null && years <= YEAR_BAND ? SIMILARITY_WEIGHTS.closeYear : 0)
  );
}

interface Ranked<T> {
  row: T;
  score: number;
  gap: number;
  published: number;
  id: string;
}

export function rankSimilar<T>(
  source: SimilarTraits,
  candidates: readonly T[],
  traitsOf: (row: T) => SimilarTraits,
  limit: number,
): T[] {
  const ranked: Ranked<T>[] = [];
  for (const row of candidates) {
    const traits = traitsOf(row);
    if (traits.id === source.id) continue;
    ranked.push({
      row,
      score: similarityScore(source, traits),
      gap: priceGap(source.pricePaise, traits.pricePaise) ?? Number.POSITIVE_INFINITY,
      published: traits.publishedAt?.getTime() ?? 0,
      id: traits.id,
    });
  }
  ranked.sort(
    (a, b) =>
      b.score - a.score ||
      a.gap - b.gap ||
      b.published - a.published ||
      (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
  );
  return ranked.slice(0, limit).map((entry) => entry.row);
}
