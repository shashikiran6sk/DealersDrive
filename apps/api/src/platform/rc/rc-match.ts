import type { BodyType, FuelType, RcMatchConfidence } from '@dealers-drive/contracts';

import type { RcSpecs } from './rc.port.js';
import {
  AMBIGUOUS_MAKERS,
  COLOUR_FAMILY_ALIASES,
  FUEL_ALIASES,
  MAKER_ALIASES,
  normaliseRcString,
  stripCorporateNoise,
} from './rc-aliases.js';

/**
 * VAHAN strings → catalogue ids (ARCHITECTURE §6.3).
 *
 * ## Why this lives in `platform/rc` and not in `modules/catalog`
 *
 * It is an anti-corruption layer, not catalogue behaviour. The catalogue owns
 * what a variant *is*; this owns what someone else's string *means*, which is
 * a property of the integration and changes when the provider does. It also
 * keeps `catalog.facade.ts` type-only, which §5.5 rule 3 requires — that
 * module exposes a vocabulary, not behaviour.
 *
 * Nothing here imports the catalog module. Rows arrive as plain data.
 *
 * ## A pure function, on purpose
 *
 * Nothing here touches Prisma, the clock, or configuration. The caller reads
 * the catalogue and passes it in. That is what makes the interesting part of
 * this feature testable as a fixture table — forty real maker strings against
 * their expected slugs — rather than only through an integration test that
 * needs a database and a provider.
 *
 * ## Confidence is a first-class output
 *
 * Every resolved field carries how sure we are, and the wizard renders `EXACT`
 * and `LIKELY` differently. This matters more than the match rate: a resolver
 * that is right 90% of the time and *says which 90%* is useful, and one that
 * is right 95% of the time and presents everything as certain will publish
 * somebody else's model name on a real listing.
 *
 * The variant is never resolved above `NONE`. RC trim strings are truncated
 * and inconsistent — `SWIFT VXI` might be a VXi, a VXi (O) or a VXi AMT, a
 * lakh apart — so the resolver ranks candidates and the dealer chooses. That
 * is a deliberate refusal to guess, not a missing feature.
 */

export interface CatalogModelRow {
  id: string;
  slug: string;
  name: string;
  bodyType: BodyType;
  yearFrom: number;
  yearTo: number | null;
}

export interface CatalogMakeRow {
  id: string;
  slug: string;
  name: string;
  models: CatalogModelRow[];
}

export interface CatalogVariantRow {
  id: string;
  name: string;
  fuel: FuelType;
  transmission: string;
  engineCc: number | null;
  seats: number | null;
}

export interface Candidate {
  id: string;
  name: string;
  hint: string | null;
}

export interface Resolved<T> {
  value: T | null;
  name: string | null;
  confidence: RcMatchConfidence;
  candidates: Candidate[];
}

const none = <T>(): Resolved<T> => ({
  value: null,
  name: null,
  confidence: 'NONE',
  candidates: [],
});

// ─────────── make ──────────────────────────────────────────────────────────

/**
 * `makerDescription` → a make.
 *
 * Four passes, most specific first. The model string is consulted only for
 * manufacturers that genuinely build for several brands; using it more widely
 * would let a model name override a maker string that was already correct.
 */
export function resolveMake(specs: RcSpecs, makes: CatalogMakeRow[]): Resolved<string> {
  const raw = specs.makerDescription;
  if (!raw) return none();

  const normalised = normaliseRcString(raw);
  const bySlug = new Map(makes.map((make) => [make.slug, make]));

  // 1. Exact alias.
  const direct = MAKER_ALIASES[normalised];
  if (direct) {
    const make = bySlug.get(direct);
    if (make) return { value: make.id, name: make.name, confidence: 'EXACT', candidates: [] };
  }

  // 2. A manufacturer that builds several brands — let the model decide.
  const brands = AMBIGUOUS_MAKERS[normalised];
  if (brands) {
    const decided = decideByModel(brands, specs.makerModel, bySlug);
    if (decided) {
      return { value: decided.id, name: decided.name, confidence: 'LIKELY', candidates: [] };
    }
    // Could not decide. Offer the brands rather than picking one.
    const candidates = brands
      .map((slug) => bySlug.get(slug))
      .filter((make): make is CatalogMakeRow => make !== undefined)
      .map((make) => ({ id: make.id, name: make.name, hint: null }));
    return { value: null, name: null, confidence: 'NONE', candidates };
  }

  // 3. Alias again with corporate scaffolding removed — catches `TATA MOTORS
  //    PVT LTD` where only `TATA MOTORS LTD` is listed.
  const stripped = stripCorporateNoise(normalised);
  const viaStripped = MAKER_ALIASES[stripped];
  if (viaStripped) {
    const make = bySlug.get(viaStripped);
    if (make) return { value: make.id, name: make.name, confidence: 'EXACT', candidates: [] };
  }

  // 4. The brand name itself appears in the string — `VOLVO AUTO INDIA` with
  //    no alias row. Longest name first so `LAND ROVER` is tried before a
  //    hypothetical `ROVER`.
  const byName = [...makes]
    .sort((a, b) => b.name.length - a.name.length)
    .find((make) => {
      const name = normaliseRcString(make.name);
      return stripped === name || stripped.startsWith(`${name} `) || stripped.endsWith(` ${name}`);
    });
  if (byName) {
    return { value: byName.id, name: byName.name, confidence: 'LIKELY', candidates: [] };
  }

  return none();
}

/** Picks the brand whose model list best explains the RC's model string. */
function decideByModel(
  brands: readonly string[],
  makerModel: string | null,
  bySlug: Map<string, CatalogMakeRow>,
): CatalogMakeRow | null {
  if (!makerModel) return null;
  const tokens = tokenise(makerModel);
  if (tokens.length === 0) return null;

  let best: { make: CatalogMakeRow; score: number } | null = null;
  for (const slug of brands) {
    const make = bySlug.get(slug);
    if (!make) continue;
    for (const model of make.models) {
      const score = prefixScore(tokenise(model.name), tokens);
      if (score > 0 && (best === null || score > best.score)) best = { make, score };
    }
  }
  return best?.make ?? null;
}

// ─────────── model ─────────────────────────────────────────────────────────

/**
 * `makerModel` → a model, within an already-resolved make.
 *
 * The hard case is that VAHAN runs model and trim together with no separator:
 * `SWIFT DZIRE VDI` has to reach `Swift Dzire` rather than `Swift`, and
 * `SWIFT VXI` has to reach `Swift`. Scoring by the number of matched leading
 * tokens and preferring the longest match handles both, and `year` breaks the
 * remaining ties against each model's production window — a 2012 string that
 * could be a Dzire or a Dzire Tour is decided by which was on sale.
 */
export function resolveModel(
  makerModel: string | null,
  models: CatalogModelRow[],
  year: number | null,
): Resolved<string> {
  if (!makerModel || models.length === 0) return none();
  const tokens = tokenise(makerModel);
  if (tokens.length === 0) return none();

  const scored = models
    .map((model) => ({ model, score: prefixScore(tokenise(model.name), tokens) }))
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score || a.model.name.length - b.model.name.length);

  if (scored.length === 0) return none();

  const top = scored[0];
  if (!top) return none();

  // Everything that matched as well as the best. Usually one row.
  const tied = scored.filter((row) => row.score === top.score);
  const inProduction = year === null ? tied : tied.filter((row) => builtIn(row.model, year));
  const shortlist = inProduction.length > 0 ? inProduction : tied;

  const chosen = shortlist[0];
  if (!chosen) return none();

  const candidates = shortlist.slice(0, 5).map((row) => ({
    id: row.model.id,
    name: row.model.name,
    hint: `${row.model.yearFrom}–${row.model.yearTo ?? 'present'}`,
  }));

  // A single unambiguous match on every token of the catalogue name is as good
  // as this gets; anything else the dealer should look at.
  const unambiguous = shortlist.length === 1 && chosen.score === tokenise(chosen.model.name).length;

  return {
    value: chosen.model.id,
    name: chosen.model.name,
    confidence: unambiguous ? 'EXACT' : 'LIKELY',
    candidates: candidates.length > 1 ? candidates : [],
  };
}

function builtIn(model: CatalogModelRow, year: number): boolean {
  return year >= model.yearFrom && year <= (model.yearTo ?? new Date().getFullYear() + 1);
}

// ─────────── variant ───────────────────────────────────────────────────────

/**
 * Ranks variants for the dealer to choose from. Never returns a value.
 *
 * Engine capacity is the strongest signal an RC carries and the one a trim
 * name cannot fake: a 1197cc reading rules out every diesel variant of a Swift
 * outright. Fuel narrows it again. What is left is ordered by how much of the
 * RC's trailing text — the trim, if the string had one — matches each variant
 * name, so `SWIFT VXI` puts `VXi` above `LXi` without ever claiming it is
 * right.
 */
export function rankVariants(
  specs: RcSpecs,
  modelName: string | null,
  variants: CatalogVariantRow[],
): Resolved<string> {
  if (variants.length === 0) return none();

  const fuel = resolveFuel(specs);
  const cc = specs.cubicCapacity;

  const plausible = variants.filter((variant) => {
    if (fuel && variant.fuel !== fuel) return false;
    // ±60cc: manufacturers and RTOs round differently, and a 1197 vs 1199
    // mismatch is a transcription difference, not a different engine.
    if (cc !== null && variant.engineCc !== null && Math.abs(variant.engineCc - cc) > 60) {
      return false;
    }
    return true;
  });

  const pool = plausible.length > 0 ? plausible : variants;

  // The RC's model string minus the catalogue model name is, roughly, the trim.
  const modelTokens = modelName ? tokenise(modelName) : [];
  const trimTokens = tokenise(specs.makerModel ?? '')
    .filter((token) => !modelTokens.includes(token))
    .concat(tokenise(specs.makerVariant ?? ''));

  const scored = pool
    .map((variant) => {
      const nameTokens = tokenise(variant.name);
      const overlap = nameTokens.filter((token) => trimTokens.includes(token)).length;
      return { variant, score: overlap };
    })
    .sort((a, b) => b.score - a.score || a.variant.name.localeCompare(b.variant.name));

  return {
    value: null,
    name: null,
    // Always NONE. The dealer confirms the variant — see the note at the top.
    confidence: 'NONE',
    candidates: scored.slice(0, 12).map((row) => ({
      id: row.variant.id,
      name: row.variant.name,
      hint: [
        row.variant.engineCc ? `${row.variant.engineCc}cc` : null,
        row.variant.transmission === 'AUTOMATIC' ? 'Automatic' : 'Manual',
      ]
        .filter(Boolean)
        .join(' · '),
    })),
  };
}

// ─────────── scalars ───────────────────────────────────────────────────────

export function resolveFuel(specs: RcSpecs): FuelType | null {
  if (!specs.fuelType) return null;
  const mapped = FUEL_ALIASES[normaliseRcString(specs.fuelType)];
  return (mapped as FuelType | undefined) ?? null;
}

/**
 * The model year.
 *
 * Manufacture date wins over registration date: a car built in December 2019
 * and registered in January 2020 is a 2019 model, and every buyer and price
 * guide treats it that way. Falling back to registration is better than
 * nothing but is a year late roughly one time in twelve, which is why it is
 * only `LIKELY`.
 */
export function resolveYear(specs: RcSpecs): Resolved<number> {
  const manufactured = yearOf(specs.manufacturedOn);
  if (manufactured !== null) {
    return { value: manufactured, name: String(manufactured), confidence: 'EXACT', candidates: [] };
  }
  const registered = yearOf(specs.registeredOn);
  if (registered !== null) {
    return { value: registered, name: String(registered), confidence: 'LIKELY', candidates: [] };
  }
  return none();
}

function yearOf(iso: string | null): number | null {
  if (!iso) return null;
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return null;
  const year = parsed.getUTCFullYear();
  return year >= 1950 && year <= new Date().getFullYear() + 1 ? year : null;
}

/** The colour *family*, never a specific shade. See `COLOUR_FAMILY_ALIASES`. */
export function resolveColourFamily(specs: RcSpecs): string | null {
  if (!specs.colorType) return null;
  return COLOUR_FAMILY_ALIASES[normaliseRcString(specs.colorType)] ?? null;
}

/**
 * The RTO code, from the plate rather than from the provider's RTO name.
 *
 * `TN09BX1234` → `TN-09`. Deterministic, provider-independent, and immune to
 * the spelling differences that make `rtoName` useless for matching —
 * "VELLORE", "VELLORE RTO" and "RTO VELLORE" are all the same office.
 *
 * BH-series marks are national rather than state-issued and have no RTO code,
 * so they correctly return null and the dealer picks.
 */
export function rtoCodeFromPlate(registrationNumber: string): string | null {
  const match = /^([A-Z]{2})(\d{1,2})/.exec(registrationNumber.toUpperCase());
  if (!match) return null;
  const [, state, district] = match;
  if (!state || !district) return null;
  return `${state}-${district.padStart(2, '0')}`;
}

// ─────────── tokens ────────────────────────────────────────────────────────

/**
 * `Swift Dzire` → `['SWIFT','DZIRE']`, `XUV500 W8` → `['XUV500','W8']`.
 *
 * Single characters are dropped: they are almost always a stray separator, and
 * a one-letter token matches far too much.
 */
function tokenise(value: string): string[] {
  return normaliseRcString(value)
    .split(' ')
    .filter((token) => token.length > 1);
}

/**
 * How many of `needle`'s tokens appear, in order, at the start of `haystack`.
 *
 * Zero unless the first token matches, which is what stops `Dzire` matching
 * `SWIFT DZIRE VDI` on its own and beating `Swift Dzire` — the model name has
 * to start where the RC string starts.
 */
function prefixScore(needle: string[], haystack: string[]): number {
  if (needle.length === 0 || haystack.length === 0) return 0;
  let matched = 0;
  for (let index = 0; index < needle.length && index < haystack.length; index += 1) {
    if (needle[index] !== haystack[index]) break;
    matched += 1;
  }
  return matched === needle.length ? matched : 0;
}
