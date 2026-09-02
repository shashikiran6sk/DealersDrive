import { z } from 'zod';

import { CityRef, CursorPage, ImageRef, OffsetPage, Uuid } from './common.js';
import {
  BodyType,
  EnquirySource,
  FuelType,
  InsuranceType,
  PriceNegotiability,
  Transmission,
} from './enums.js';

/**
 * PART A — the public API (API-SPEC A1–A15). No authentication anywhere in
 * this file, and no dealer phone number in any response shape: the only route
 * that returns one is A7, and it is deliberately a POST.
 */

/** CSV means OR within a facet: `fuel=diesel,petrol`. */
const splitCsv = (value: string): string[] =>
  value
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);

const csvSlugs = z
  .string()
  .transform(splitCsv)
  .pipe(
    z
      .array(z.string().regex(/^[a-z0-9-]+$/))
      .min(1)
      .max(20),
  );

const csvWords = z
  .string()
  .transform(splitCsv)
  .pipe(
    z
      .array(z.string().regex(/^[a-z_]+$/))
      .min(1)
      .max(20),
  );

const csvInts = z
  .string()
  .transform(splitCsv)
  .pipe(
    z
      .array(z.string().regex(/^[1-9]$/))
      .min(1)
      .max(9),
  )
  .transform((values) => values.map(Number));

export const SortOption = z.enum([
  'relevance',
  'price_asc',
  'price_desc',
  'year_desc',
  'km_asc',
  'newest',
]);
export type SortOption = z.infer<typeof SortOption>;

/**
 * A2 query grammar. `.strict()` is the point: an unknown parameter is a 400,
 * never a silent ignore, because silent ignoring hides frontend bugs for
 * months (ARCHITECTURE §9.2).
 */
export const VehicleQuery = z
  .object({
    city: z
      .string()
      .regex(/^[a-z0-9-]+$/)
      .optional(),
    q: z.string().max(120).optional(),
    make: csvSlugs.optional(),
    model: csvSlugs.optional(),
    variant: csvSlugs.optional(),
    priceMin: z.coerce.number().int().min(0).optional(),
    priceMax: z.coerce.number().int().min(0).optional(),
    yearMin: z.coerce.number().int().min(1950).max(2100).optional(),
    yearMax: z.coerce.number().int().min(1950).max(2100).optional(),
    kmMax: z.coerce.number().int().min(0).optional(),
    fuel: csvWords.optional(),
    transmission: csvWords.optional(),
    bodyType: csvWords.optional(),
    owners: csvInts.optional(),
    seats: z.coerce.number().int().min(2).max(10).optional(),
    airbagsMin: z.coerce.number().int().min(0).max(12).optional(),
    color: csvSlugs.optional(),
    rtoState: z
      .string()
      .regex(/^[A-Za-z]{2}$/)
      .optional(),
    rto: z
      .string()
      .regex(/^[A-Za-z]{2}-?\d{1,2}$/)
      .optional(),
    dealer: csvSlugs.optional(),
    sort: SortOption.default('relevance'),
    page: z.coerce.number().int().min(1).max(40).default(1),
    limit: z.coerce.number().int().min(1).max(48).default(24),
  })
  .strict();
export type VehicleQuery = z.infer<typeof VehicleQuery>;

/** The card that appears on the homepage, in search, on a portfolio and in saved cars. */
export const VehicleCard = z.object({
  id: Uuid,
  slug: z.string(),
  year: z.number().int(),
  title: z.string(),
  pricePaise: z.number().int(),
  priceLabel: z.string(),
  emiPaise: z.number().int(),
  emiLabel: z.string(),
  kmDriven: z.number().int(),
  kmLabel: z.string(),
  fuel: FuelType,
  fuelLabel: z.string(),
  transmission: Transmission,
  transmissionLabel: z.string(),
  bodyType: BodyType,
  city: CityRef,
  /** The dealer strip appears on every card, without exception. That is the product. */
  dealer: z.object({
    slug: z.string(),
    brandName: z.string(),
    initials: z.string(),
    isVerified: z.boolean(),
  }),
  primaryImage: ImageRef.nullable(),
  photoCount: z.number().int(),
  /**
   * A sold car stays on the marketplace as proof the dealer moves stock, but it
   * is not for sale: the card renders inert — no link, no save, no enquiry —
   * and A5 refuses its detail page. The API decides this, once, so a client
   * cannot render a clickable sold car by forgetting a check.
   */
  isSold: z.boolean(),
  soldLabel: z.string().nullable(),
});
export type VehicleCard = z.infer<typeof VehicleCard>;

export const AppliedFilter = z.object({
  key: z.string(),
  value: z.string(),
  label: z.string(),
  removeHref: z.string(),
});
export type AppliedFilter = z.infer<typeof AppliedFilter>;

export const VehicleListResponse = z.object({
  data: z.array(VehicleCard),
  page: OffsetPage,
  resultLabel: z.string(),
  appliedFilters: z.array(AppliedFilter),
  clearAllHref: z.string(),
});
export type VehicleListResponse = z.infer<typeof VehicleListResponse>;

export const FacetOption = z.object({
  value: z.string(),
  label: z.string(),
  count: z.number().int(),
});
export type FacetOption = z.infer<typeof FacetOption>;

/** Count-0 options are returned and rendered disabled — never omitted (§11.2). */
export const FacetsResponse = z.object({
  priceRange: z.object({
    min: z.number().int(),
    max: z.number().int(),
    step: z.number().int(),
    minLabel: z.string(),
    maxLabel: z.string(),
  }),
  fuel: z.array(FacetOption),
  bodyType: z.array(FacetOption),
  transmission: z.array(FacetOption),
  dealer: z.array(FacetOption),
  owners: z.array(FacetOption),
  color: z.array(FacetOption),
  rtoState: z.array(FacetOption),
});
export type FacetsResponse = z.infer<typeof FacetsResponse>;

// ─────────── A1 home ───────────────────────────────────────────────────────
export const HomeQuery = z.object({ city: z.string().max(60).optional() }).strict();
export type HomeQuery = z.infer<typeof HomeQuery>;

export const DealerStripItem = z.object({
  slug: z.string(),
  brandName: z.string(),
  initials: z.string(),
  city: z.string(),
  yearsOperating: z.number().int(),
  carCount: z.number().int(),
  isVerified: z.boolean(),
  logoUrl: z.string().nullable(),
});
export type DealerStripItem = z.infer<typeof DealerStripItem>;

export const HomeResponse = z.object({
  city: CityRef,
  activeCount: z.number().int(),
  activeCountLabel: z.string(),
  popularSearches: z.array(z.object({ label: z.string(), href: z.string() })),
  featured: z.array(VehicleCard),
  bodyTypes: z.array(z.object({ slug: z.string(), label: z.string(), count: z.number().int() })),
  dealers: z.array(DealerStripItem),
});
export type HomeResponse = z.infer<typeof HomeResponse>;

// ─────────── A4 batch (saved cars) ─────────────────────────────────────────
export const VehicleBatchInput = z.object({ ids: z.array(Uuid).max(100) }).strict();
export type VehicleBatchInput = z.infer<typeof VehicleBatchInput>;

export const VehicleBatchResponse = z.object({
  data: z.array(VehicleCard),
  /** A car that has left the catalogue must never 404 the whole request. */
  unavailable: z.array(
    z.object({ id: Uuid, reason: z.enum(['SOLD', 'EXPIRED', 'REMOVED', 'NOT_FOUND']) }),
  ),
  savedCountLabel: z.string(),
});
export type VehicleBatchResponse = z.infer<typeof VehicleBatchResponse>;

// ─────────── A5 vehicle detail ─────────────────────────────────────────────
export const VehiclePhoto = z.object({
  id: Uuid,
  position: z.number().int(),
  label: z.string(),
  url: z.string(),
  srcset: z.string(),
  blurhash: z.string().nullable(),
  width: z.number().int().nullable(),
  height: z.number().int().nullable(),
});
export type VehiclePhoto = z.infer<typeof VehiclePhoto>;

export const VehicleDetail = z.object({
  id: Uuid,
  slug: z.string(),
  listingId: Uuid,
  year: z.number().int(),
  title: z.string(),
  make: z.object({ slug: z.string(), name: z.string() }),
  model: z.object({ slug: z.string(), name: z.string() }),
  variant: z.object({ slug: z.string(), name: z.string() }).nullable(),
  summary: z.string(),
  price: z.object({
    pricePaise: z.number().int(),
    priceLabel: z.string(),
    emiLabel: z.string(),
    negotiable: PriceNegotiability,
    negotiableLabel: z.string(),
  }),
  specs: z.array(z.object({ key: z.string(), label: z.string(), value: z.string() })),
  features: z.array(z.string()),
  description: z.string().nullable(),
  photos: z.array(VehiclePhoto),
  photoCount: z.number().int(),
  photoCountLabel: z.string(),
  /** No `phone` field. It appears in no public response body, ever (§14.1). */
  dealer: z.object({
    slug: z.string(),
    brandName: z.string(),
    initials: z.string(),
    city: z.string(),
    carCount: z.number().int(),
    carCountLabel: z.string(),
    isVerified: z.boolean(),
    logoUrl: z.string().nullable(),
  }),
  seo: z.object({
    canonical: z.string(),
    title: z.string(),
    description: z.string(),
    isIndexable: z.boolean(),
  }),
});
export type VehicleDetail = z.infer<typeof VehicleDetail>;

export const SimilarQuery = z
  .object({ limit: z.coerce.number().int().min(1).max(12).default(4) })
  .strict();
export type SimilarQuery = z.infer<typeof SimilarQuery>;

// ─────────── A7 reveal contact ─────────────────────────────────────────────
export const RevealContactInput = z
  .object({
    captchaToken: z.string().max(4000).nullish(),
    name: z.string().max(80).nullish(),
  })
  .strict();
export type RevealContactInput = z.infer<typeof RevealContactInput>;

export const RevealContactResponse = z.object({
  phone: z.string(),
  phoneDisplay: z.string(),
  dealer: z.object({ slug: z.string(), brandName: z.string() }),
  callHref: z.string(),
  whatsappHref: z.string(),
  revealsRemainingToday: z.number().int(),
});
export type RevealContactResponse = z.infer<typeof RevealContactResponse>;

// ─────────── A8–A11 dealers ────────────────────────────────────────────────
export const DealerDirectoryQuery = z
  .object({
    city: z
      .string()
      .regex(/^[a-z0-9-]+$/)
      .optional(),
    q: z.string().max(120).optional(),
    page: z.coerce.number().int().min(1).max(40).default(1),
    limit: z.coerce.number().int().min(1).max(48).default(24),
  })
  .strict();
export type DealerDirectoryQuery = z.infer<typeof DealerDirectoryQuery>;

export const DealerCard = z.object({
  slug: z.string(),
  brandName: z.string(),
  initials: z.string(),
  city: z.string(),
  state: z.string(),
  yearsOperating: z.number().int(),
  yearsLabel: z.string(),
  tagline: z.string().nullable(),
  services: z.array(z.string()),
  carCount: z.number().int(),
  fromPricePaise: z.number().int().nullable(),
  fromPriceLabel: z.string(),
  isVerified: z.boolean(),
  logoUrl: z.string().nullable(),
  coverUrl: z.string().nullable(),
});
export type DealerCard = z.infer<typeof DealerCard>;

export const DealerDirectoryResponse = z.object({
  data: z.array(DealerCard),
  page: OffsetPage,
  countLabel: z.string(),
  cities: z.array(z.object({ slug: z.string(), name: z.string(), count: z.number().int() })),
});
export type DealerDirectoryResponse = z.infer<typeof DealerDirectoryResponse>;

export const DealerPublicProfile = z.object({
  slug: z.string(),
  brandName: z.string(),
  legalName: z.string(),
  initials: z.string(),
  isVerified: z.boolean(),
  about: z.string().nullable(),
  services: z.array(z.string()),
  address: z.object({
    line: z.string().nullable(),
    city: z.string(),
    state: z.string(),
    pincode: z.string().nullable(),
    full: z.string(),
    lat: z.number().nullable(),
    lng: z.number().nullable(),
    directionsUrl: z.string().nullable(),
  }),
  stats: z.array(z.object({ key: z.string(), label: z.string(), value: z.string() })),
  /** `contact[phone].masked` is true and carries no number — A7 is the only way. */
  contact: z.array(
    z.object({
      key: z.string(),
      label: z.string(),
      value: z.string(),
      masked: z.boolean().optional(),
      mono: z.boolean().optional(),
    }),
  ),
  logoUrl: z.string().nullable(),
  coverUrl: z.string().nullable(),
  seo: z.object({ canonical: z.string(), title: z.string(), isIndexable: z.boolean() }),
});
export type DealerPublicProfile = z.infer<typeof DealerPublicProfile>;

export const DealerVehiclesResponse = z.object({
  data: z.array(VehicleCard),
  page: OffsetPage,
  resultLabel: z.string(),
});
export type DealerVehiclesResponse = z.infer<typeof DealerVehiclesResponse>;

// ─────────── A12 cities ────────────────────────────────────────────────────
export const CitiesResponse = z.object({
  data: z.array(
    z.object({
      slug: z.string(),
      name: z.string(),
      state: z.string().optional(),
      count: z.number().int(),
    }),
  ),
  default: z.string(),
});
export type CitiesResponse = z.infer<typeof CitiesResponse>;

// ─────────── A13 catalog bundle ────────────────────────────────────────────
/**
 * A13. Makes and models, **without** variants.
 *
 * The catalogue is ~2,000 variants across 344 models. Nesting them here would
 * put roughly 400KB of JSON into the add-vehicle page's props for the sake of
 * the twelve rows the dealer will actually look at, which on a yard's 4G is
 * the difference between a form and a wait. `GET /v1/catalog/models/{id}/variants`
 * fetches the one model's list when a model is picked; everything else in this
 * bundle is small enough to ship whole and is needed before the first render.
 */
export const CatalogBundle = z.object({
  version: z.string(),
  makes: z.array(
    z.object({
      id: Uuid,
      slug: z.string(),
      name: z.string(),
      popularity: z.number().int(),
      models: z.array(
        z.object({
          id: Uuid,
          slug: z.string(),
          name: z.string(),
          bodyType: BodyType,
          yearFrom: z.number().int(),
          yearTo: z.number().int().nullable(),
          /** How many rows `/v1/catalog/models/{id}/variants` will return. */
          variantCount: z.number().int(),
        }),
      ),
    }),
  ),
  cities: z.array(z.object({ id: Uuid, slug: z.string(), name: z.string(), state: z.string() })),
  rto: z.array(
    z.object({ code: z.string(), name: z.string(), city: z.string(), state: z.string() }),
  ),
  colors: z.array(
    z.object({
      id: Uuid,
      slug: z.string(),
      name: z.string(),
      hex: z.string(),
      family: z.string(),
    }),
  ),
  fuels: z.array(z.object({ value: FuelType, label: z.string() })),
  transmissions: z.array(z.object({ value: Transmission, label: z.string() })),
  bodyTypes: z.array(z.object({ value: BodyType, label: z.string() })),
  insuranceTypes: z.array(z.object({ value: InsuranceType, label: z.string() })),
  owners: z.array(z.object({ value: z.number().int(), label: z.string() })),
  features: z.array(z.string()),
});
export type CatalogBundle = z.infer<typeof CatalogBundle>;

export const CatalogVariant = z.object({
  id: Uuid,
  slug: z.string(),
  name: z.string(),
  fuel: FuelType,
  transmission: Transmission,
  engineCc: z.number().int().nullable(),
  seats: z.number().int().nullable(),
  /** "VXi · Petrol · Manual · 1197cc" — composed once, here (API-SPEC §0.4). */
  label: z.string(),
});
export type CatalogVariant = z.infer<typeof CatalogVariant>;

/** A13b — one model's variants, for the dependent Make → Model → Variant step. */
export const ModelVariantsResponse = z.object({
  modelId: Uuid,
  modelName: z.string(),
  makeName: z.string(),
  bodyType: BodyType,
  yearFrom: z.number().int(),
  yearTo: z.number().int().nullable(),
  data: z.array(CatalogVariant),
});
export type ModelVariantsResponse = z.infer<typeof ModelVariantsResponse>;

// ─────────── A14 public config ─────────────────────────────────────────────
export const PublicConfig = z.object({
  mediaBaseUrl: z.string(),
  captchaSiteKey: z.string().nullable(),
  supportEmail: z.string(),
  supportPhone: z.string(),
  minPhotosPerListing: z.number().int(),
  listingDurationDays: z.number().int(),
  enquiryRateLimitPerHour: z.number().int(),
  photoRequestsEnabled: z.boolean(),
});
export type PublicConfig = z.infer<typeof PublicConfig>;

// ─────────── A15 enquiries ─────────────────────────────────────────────────
/**
 * Exactly one of vehicleId / dealerSlug must be present — the portfolio's
 * "Enquire with dealer" button produces a real lead with no vehicle attached.
 */
export const CreateEnquiryInput = z
  .object({
    vehicleId: Uuid.optional(),
    dealerSlug: z
      .string()
      .regex(/^[a-z0-9-]+$/)
      .optional(),
    name: z.string().trim().min(2, 'Tell us your name.').max(80),
    phone: z
      .string()
      .trim()
      .regex(/^(\+?91[- ]?)?[6-9]\d{9}$/, 'Enter a 10-digit Indian mobile number.'),
    email: z.string().trim().email('Enter a valid email address.').optional().or(z.literal('')),
    message: z.string().trim().max(1000).optional(),
    source: EnquirySource,
    captchaToken: z.string().max(4000).nullish(),
    /** Honeypot. Non-empty means a bot: a normal 201 with nothing written. */
    website: z.string().max(200).optional(),
  })
  .strict()
  .refine((value) => Boolean(value.vehicleId) !== Boolean(value.dealerSlug), {
    message: 'Provide exactly one of vehicleId or dealerSlug.',
    path: ['vehicleId'],
  });
export type CreateEnquiryInput = z.infer<typeof CreateEnquiryInput>;

export const EnquiryCreatedResponse = z.object({
  reference: z.string(),
  createdAt: z.string(),
  dealer: z.object({
    slug: z.string(),
    brandName: z.string(),
    responseTimeLabel: z.string(),
  }),
  vehicle: z
    .object({
      id: Uuid,
      slug: z.string(),
      title: z.string(),
      priceLabel: z.string(),
      city: z.string(),
      thumbnailUrl: z.string().nullable(),
    })
    .nullable(),
  isDuplicate: z.boolean(),
});
export type EnquiryCreatedResponse = z.infer<typeof EnquiryCreatedResponse>;

export const CursorListPage = CursorPage;
