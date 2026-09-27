import { slugify, type CarSuggestion, type CarSuggestionKind } from '@dealers-drive/contracts';
import type { Prisma } from '@prisma/client';

import { listingWhere, wordsOf } from './search.filters.js';
import { SUGGEST_META } from './search.messages.js';

export interface SuggestRow {
  make: string | null;
  model: string | null;
  variant: string | null;
  count: number;
}

interface Candidate {
  kind: CarSuggestionKind;
  brand: string;
  model: string | null;
  count: number;
  names: Map<string, number>;
  variants: Map<string, number>;
}

const KIND_ORDER: Record<CarSuggestionKind, number> = { BRAND: 0, MODEL: 1, VARIANT: 2 };

export function suggestWhere(
  search: string,
  dealerIds: readonly string[] | null,
): Prisma.VehicleWhereInput {
  const words = wordsOf(search).map((word) => ({ contains: word, mode: 'insensitive' as const }));
  return {
    AND: words.map((contains) => ({
      OR: [{ make: contains }, { model: contains }, { variant: contains }],
    })),
    listing: { is: listingWhere(dealerIds) },
  };
}

function tally(map: Map<string, number>, key: string, count: number): void {
  map.set(key, (map.get(key) ?? 0) + count);
}

function commonest(map: Map<string, number>): string {
  let best = '';
  let bestCount = -1;
  for (const [key, count] of map) {
    if (count > bestCount || (count === bestCount && key.localeCompare(best) < 0)) {
      best = key;
      bestCount = count;
    }
  }
  return best;
}

function add(
  into: Map<string, Candidate>,
  key: string,
  seed: Omit<Candidate, 'count' | 'names' | 'variants'>,
  name: string,
  variant: string | null,
  count: number,
): void {
  const found = into.get(key) ?? {
    ...seed,
    count: 0,
    names: new Map<string, number>(),
    variants: new Map<string, number>(),
  };
  found.count += count;
  tally(found.names, name, count);
  if (variant !== null) tally(found.variants, variant, count);
  into.set(key, found);
}

function candidatesOf(rows: readonly SuggestRow[]): Candidate[] {
  const all = new Map<string, Candidate>();

  for (const row of rows) {
    const make = row.make?.trim() ?? '';
    const brand = slugify(make);
    if (!brand) continue;
    add(all, `b:${brand}`, { kind: 'BRAND', brand, model: null }, make, null, row.count);

    const model = row.model?.trim() ?? '';
    const modelSlug = slugify(model);
    if (!modelSlug) continue;
    add(
      all,
      `m:${brand}:${modelSlug}`,
      { kind: 'MODEL', brand, model: modelSlug },
      model,
      null,
      row.count,
    );

    const variant = row.variant?.trim().replace(/\s+/g, ' ') ?? '';
    if (!variant) continue;
    add(
      all,
      `v:${brand}:${modelSlug}:${variant.toLowerCase()}`,
      { kind: 'VARIANT', brand, model: modelSlug },
      model,
      variant,
      row.count,
    );
  }

  return [...all.values()];
}

function toSuggestion(candidate: Candidate, makes: ReadonlyMap<string, string>): CarSuggestion {
  const make = makes.get(candidate.brand) ?? '';
  const model = candidate.kind === 'BRAND' ? null : commonest(candidate.names);
  const variant = candidate.kind === 'VARIANT' ? commonest(candidate.variants) : null;
  return {
    kind: candidate.kind,
    label: [make, model, variant].filter((part) => part !== null).join(' '),
    metaLabel: SUGGEST_META(candidate.kind, candidate.count),
    brand: candidate.brand,
    model: candidate.model,
    variant,
    count: candidate.count,
  };
}

function scoreOf(label: string, search: string, words: readonly string[]): number | null {
  const text = label.toLowerCase();
  if (!words.every((word) => text.includes(word))) return null;
  if (text.startsWith(search)) return 0;
  const spaced = ` ${text}`;
  if (words.every((word) => spaced.includes(` ${word}`))) return 1;
  return 2;
}

export function rankSuggestions(
  rows: readonly SuggestRow[],
  search: string,
  limit: number,
): { data: CarSuggestion[]; total: number } {
  const needle = search.trim().toLowerCase().replace(/\s+/g, ' ');
  const words = wordsOf(needle);

  const candidates = candidatesOf(rows);
  const makes = new Map(
    candidates.flatMap((candidate) =>
      candidate.kind === 'BRAND' ? [[candidate.brand, commonest(candidate.names)] as const] : [],
    ),
  );

  const ranked = candidates
    .map((candidate) => toSuggestion(candidate, makes))
    .flatMap((suggestion) => {
      const score = scoreOf(suggestion.label, needle, words);
      return score === null ? [] : [{ suggestion, score }];
    })
    .sort(
      (a, b) =>
        a.score - b.score ||
        KIND_ORDER[a.suggestion.kind] - KIND_ORDER[b.suggestion.kind] ||
        b.suggestion.count - a.suggestion.count ||
        a.suggestion.label.localeCompare(b.suggestion.label),
    );

  return { data: ranked.slice(0, limit).map((row) => row.suggestion), total: ranked.length };
}
