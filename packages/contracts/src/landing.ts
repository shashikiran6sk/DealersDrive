import { z } from 'zod';

import { slugify } from './common.js';
import {
  BODY_TYPE_LABELS,
  BodyType,
  FUEL_LABELS,
  FuelType,
  TRANSMISSION_LABELS,
  Transmission,
} from './enums.js';
import { BodyTypeSlug, FuelSlug, TransmissionSlug } from './public.js';
import { VEHICLE_MAKES, vehicleMakeSlug, type VehicleMake } from './vehicle-makes.js';

/**
 * SEO landing pages — `/used-cars/{place}` and `/used-cars/{place}/{facet}`.
 *
 * A landing page is a search the marketplace already answers (`/v1/vehicles`
 * with a district or town and at most one filter), given a clean address and a
 * title a buyer would type: "used Maruti Suzuki cars in Ranipet", "used diesel
 * cars in Arcot", "used cars under 5 lakh in Vellore".
 *
 * ## The threshold
 *
 * A page is **indexable only with at least `LANDING_MIN_CARS` available cars**.
 * A page with one car still renders (a buyer who follows a link is shown the
 * car), but it is `noindex` and absent from the sitemap: a page that exists to
 * show a single listing is the car's own page with less on it, and a site with
 * many of those reads as thin to a search engine.
 *
 * ## The vocabulary is closed
 *
 * Every facet slug is one of a fixed set — a fuel, a body type, a transmission,
 * a price ceiling, a brand from `VEHICLE_MAKES`, or a brand followed by a model.
 * A brand that does not resolve to the closed list never gets a page, so the
 * D1 fragmentation (`Maruti` beside `Maruti Suzuki`) cannot produce two.
 */
export const LANDING_MIN_CARS = 2;

/** The price ceilings a landing page exists for, in lakh: "under ₹5 lakh". */
export const LANDING_PRICE_LAKHS = [3, 5, 7, 10] as const;
export type LandingPriceLakhs = (typeof LANDING_PRICE_LAKHS)[number];

/** One sitemap file holds 50,000 URLs; the landing pages are capped like the entity lists. */
export const LANDING_PAGE_LIMIT = 45_000;

const LAKH_PAISE = 10_000_000;

export const LandingFacetKind = z.enum([
  'BRAND',
  'MODEL',
  'FUEL',
  'BODY_TYPE',
  'TRANSMISSION',
  'PRICE',
]);
export type LandingFacetKind = z.infer<typeof LandingFacetKind>;

/**
 * Whether a place is a district or a town inside one.
 *
 * A town whose slug is its own district's (Vellore in Vellore) is **not** a
 * second place: the district stands for it, so the two can never compete for
 * the same search. A town belongs to the district most of its dealerships are
 * in, so one dealership filed under the wrong district cannot take the town's
 * page away. A tie between districts, or a town slug that names a different
 * district, is ambiguous and gets no place at all — no page beats a page that
 * shows the wrong town's cars.
 */
export const LandingPlaceKind = z.enum(['DISTRICT', 'TOWN']);
export type LandingPlaceKind = z.infer<typeof LandingPlaceKind>;

/** The search parameters a facet stands for, in the names `PublicVehicleQuery` takes. */
export type LandingParams = Partial<
  Record<'brand' | 'model' | 'fuel' | 'transmission' | 'bodyType' | 'maxPrice', string>
>;

export interface LandingFacet {
  kind: LandingFacetKind;
  slug: string;
  params: LandingParams;
}

export function priceLandingSlug(lakhs: LandingPriceLakhs): string {
  return `under-${lakhs}-lakh`;
}

/** The inclusive ceiling, in paise like every money field (rule 3). */
export function landingPriceCeiling(lakhs: LandingPriceLakhs): number {
  return lakhs * LAKH_PAISE;
}

export function brandLandingSlug(make: VehicleMake): string {
  return vehicleMakeSlug(make);
}

/** `Maruti Suzuki` + `Swift` -> `maruti-suzuki-swift`. */
export function modelLandingSlug(make: VehicleMake, model: string): string {
  return `${brandLandingSlug(make)}-${slugify(model)}`;
}

const PRICE_SLUG = /^under-(\d+)-lakh$/;
const MODEL_REST = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const BRANDS_LONGEST_FIRST: readonly { make: VehicleMake; slug: string }[] = VEHICLE_MAKES.map(
  (make) => ({ make, slug: brandLandingSlug(make) }),
).sort((a, b) => b.slug.length - a.slug.length);

function priceLakhsOf(slug: string): LandingPriceLakhs | null {
  const match = PRICE_SLUG.exec(slug);
  if (!match) return null;
  const lakhs = Number(match[1]);
  return LANDING_PRICE_LAKHS.find((value) => value === lakhs) ?? null;
}

/**
 * The facet a URL segment names, or `null` when it names none — which the page
 * answers with a 404.
 *
 * The fixed sets are tried first, then a brand, then a brand followed by a
 * model; the longest brand wins, so `land-rover-…` is never read as a model of
 * a shorter brand.
 */
export function parseLandingFacet(slug: string): LandingFacet | null {
  const fuel = FuelSlug.safeParse(slug);
  if (fuel.success) return { kind: 'FUEL', slug, params: { fuel: fuel.data } };

  const body = BodyTypeSlug.safeParse(slug);
  if (body.success) return { kind: 'BODY_TYPE', slug, params: { bodyType: body.data } };

  const transmission = TransmissionSlug.safeParse(slug);
  if (transmission.success) {
    return { kind: 'TRANSMISSION', slug, params: { transmission: transmission.data } };
  }

  const lakhs = priceLakhsOf(slug);
  if (lakhs !== null) {
    return { kind: 'PRICE', slug, params: { maxPrice: String(landingPriceCeiling(lakhs)) } };
  }

  for (const brand of BRANDS_LONGEST_FIRST) {
    if (slug === brand.slug) return { kind: 'BRAND', slug, params: { brand: brand.slug } };
    const rest = slug.startsWith(`${brand.slug}-`) ? slug.slice(brand.slug.length + 1) : '';
    if (MODEL_REST.test(rest)) {
      return { kind: 'MODEL', slug, params: { brand: brand.slug, model: rest } };
    }
  }
  return null;
}

function brandOf(slug: string | undefined): VehicleMake | undefined {
  return BRANDS_LONGEST_FIRST.find((brand) => brand.slug === slug)?.make;
}

function titleCase(slug: string): string {
  return slug
    .split('-')
    .filter((word) => word.length > 0)
    .map((word) => `${word.charAt(0).toUpperCase()}${word.slice(1)}`)
    .join(' ');
}

/**
 * How a facet is named in a title: `Maruti Suzuki`, `Maruti Suzuki Swift`,
 * `Diesel`, `SUV`, `Automatic`, `Under ₹5 lakh`.
 *
 * A model is spelled the way dealers most often spell it when the caller knows
 * (`modelName`, from the landing read); otherwise its slug is title-cased.
 */
export function landingFacetLabel(facet: LandingFacet, modelName?: string | null): string {
  switch (facet.kind) {
    case 'FUEL':
      return FUEL_LABELS[FuelType.parse(facet.params.fuel?.toUpperCase())];
    case 'BODY_TYPE':
      return BODY_TYPE_LABELS[BodyType.parse(facet.params.bodyType?.toUpperCase())];
    case 'TRANSMISSION':
      return TRANSMISSION_LABELS[Transmission.parse(facet.params.transmission?.toUpperCase())];
    case 'PRICE':
      return `Under ₹${Number(facet.params.maxPrice) / LAKH_PAISE} lakh`;
    case 'BRAND':
      return brandOf(facet.params.brand) ?? titleCase(facet.slug);
    case 'MODEL': {
      const brand = brandOf(facet.params.brand) ?? titleCase(facet.params.brand ?? '');
      return `${brand} ${modelName?.trim() || titleCase(facet.params.model ?? '')}`;
    }
  }
}

/** `GET /v1/landing-pages` takes nothing, and says so (rule 2). */
export const LandingPagesQuery = z.object({}).strict();
export type LandingPagesQuery = z.infer<typeof LandingPagesQuery>;

/** A district or a town that holds at least one ACTIVE dealership. */
export const LandingPlace = z.object({
  /** The URL segment: a district's canonical filter slug, or a town's slug. */
  slug: z.string(),
  /** As the dealerships spell it — the most common spelling when they differ. */
  name: z.string(),
  kind: LandingPlaceKind,
  /** The district a town is in; a district is its own. */
  district: z.object({ slug: z.string(), name: z.string() }),
  state: z.string().nullable(),
  /** Available cars (**R71**) — the same count `/cars` shows for the place. */
  cars: z.number().int(),
});
export type LandingPlace = z.infer<typeof LandingPlace>;

/**
 * One place, or one place and one facet, with at least one available car.
 *
 * Pages with a single car are listed so a link to one can be answered with the
 * page rather than a 404; whether a page is indexable is `cars >= minCars`.
 */
export const LandingPage = z.object({
  place: z.string(),
  /** The facet segment, or `null` for the place's own page. */
  facet: z.string().nullable(),
  kind: LandingFacetKind.nullable(),
  /** The facet's title label (`landingFacetLabel`), or `null` for the place's own page. */
  label: z.string().nullable(),
  cars: z.number().int(),
  /** The newest change to one of its available cars — never the time of the request. */
  lastModified: z.string().nullable(),
});
export type LandingPage = z.infer<typeof LandingPage>;

/**
 * Every landing page the inventory supports (**SEO**), for the sitemap, the
 * pages themselves and the related-search links between them.
 */
export const PublicLandingPagesResponse = z.object({
  /** `LANDING_MIN_CARS`, echoed so a client never hard-codes a second copy. */
  minCars: z.number().int(),
  places: z.array(LandingPlace),
  pages: z.array(LandingPage).max(LANDING_PAGE_LIMIT),
});
export type PublicLandingPagesResponse = z.infer<typeof PublicLandingPagesResponse>;
