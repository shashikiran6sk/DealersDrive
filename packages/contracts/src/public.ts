import { OffsetPage } from './common.js';
import { z } from 'zod';

/**
 * PART A — the public API (API-SPEC A1–A15). No authentication anywhere in
 * this file, and no dealer phone number in any response shape: the only route
 * that returns one is A7, and it is deliberately a POST.
 *
 * ── Reconstruction slice ────────────────────────────────────────────────────
 * The baseline file is ~700 lines and describes the whole public surface —
 * search, facets, the home page, vehicle detail, the dealer directory. Each
 * shape arrives with the feature that first answers with it, so this file grows
 * rather than landing whole. `PublicConfig` is here because **F029** serves it
 * from `GET /v1/config/public`.
 *
 * `CitiesResponse` (A12) was here too, for F026's `GET /v1/cities`. It is gone
 * with the `cities` table — see the locality note in `dealer.ts`. Search will
 * offer the cities dealers actually trade in, counted from `listing_search` at
 * **F076**, rather than the five somebody typed into a seed file.
 * ────────────────────────────────────────────────────────────────────────────
 */

// ─────────── A14 public config ─────────────────────────────────────────────

/**
 * One place the platform can be found off the platform (**R44**).
 *
 * `network` is a closed set rather than free text because the footer draws an
 * icon from it, and an icon is not something a configuration value can invent.
 * `label` is what a screen reader announces and what the `title` says; `href`
 * is the URL an operator typed into `/admin/config`, already checked to be an
 * `https:` one before it was put on this payload.
 *
 * The array carries **only the networks that have a URL**. A network nobody has
 * opened an account for is absent, not present-and-empty, so the footer renders
 * what it is given and has no rule of its own about which links are real.
 */
export const SocialLink = z.object({
  network: z.enum(['instagram', 'facebook', 'youtube', 'linkedin', 'x', 'whatsapp']),
  label: z.string(),
  href: z.string(),
});
export type SocialLink = z.infer<typeof SocialLink>;

export const PublicConfig = z.object({
  mediaBaseUrl: z.string(),
  captchaSiteKey: z.string().nullable(),
  supportEmail: z.string(),
  supportPhone: z.string(),
  minPhotosPerListing: z.number().int(),
  listingDurationDays: z.number().int(),
  enquiryRateLimitPerHour: z.number().int(),
  photoRequestsEnabled: z.boolean(),
  /**
   * Whether "Add a vehicle" opens on the number-plate field or on today's
   * seven-dropdown Basics form. Both are complete flows, which is what makes
   * this a safe rollback rather than a half-disabled feature.
   */
  rcLookupEnabled: z.boolean(),
  /** Whether listing pages carry a records check at all. */
  vehicleReportEnabled: z.boolean(),
  /**
   * Where the platform can be found off the platform, in the order the footer
   * renders it (**R44**). Empty until an operator publishes one.
   */
  social: z.array(SocialLink),
});
export type PublicConfig = z.infer<typeof PublicConfig>;

// ─────────── A8–A9 the dealer directory ────────────────────────────────────
/**
 * A8 query grammar. `.strict()`, like every other input in this package: a
 * `/v1/dealers?town=vellore` is a 400 naming `town`, not a silently unfiltered
 * page of every dealership on the platform.
 */
export const DealerDirectoryQuery = z
  .object({
    /**
     * A city **slug**, not a city id.
     *
     * ── Deliberate divergence from the baseline ─────────────────────────────
     * It used to be the `slug` column of a `cities` row. **D6** removed that
     * table, so the slug is now derived from the name the dealership itself
     * carries — `slugify(dealer.city)` — and matched the same way on the way
     * back in. The chip links keep the shape they had, and there is no second
     * copy of the name/slug pair that can fall out of step with the first,
     * which is what the column was for.
     * ────────────────────────────────────────────────────────────────────────
     */
    city: z
      .string()
      // One slug, or several separated by commas. The chips are toggles now —
      // a buyer comparing Katpadi and Vellore is looking at one market, and
      // making them pick one town at a time is making them run the search
      // twice. A single slug still parses, so every link already shared keeps
      // working and the shape below is the same one it always was.
      .regex(/^[a-z0-9-]+(?:,[a-z0-9-]+)*$/)
      .max(400)
      .optional(),
    /**
     * The district, as a slug. One at a time.
     *
     * Cities and districts answer different questions and the split is
     * deliberate. A city is a town a buyer names; a district is the area they
     * would drive across, and the towns in one give no hint they are related —
     * Arakkonam and Walajapet share a district with Arcot and with nothing
     * else. So the header picks a district and the chips narrow to the towns
     * inside it, rather than offering every town on the platform at once.
     */
    district: z
      .string()
      .regex(/^[a-z0-9-]+$/)
      .optional(),
    q: z.string().max(120).optional(),
    page: z.coerce.number().int().min(1).max(40).default(1),
    limit: z.coerce.number().int().min(1).max(48).default(24),
  })
  .strict();
export type DealerDirectoryQuery = z.infer<typeof DealerDirectoryQuery>;

/**
 * One dealership as the directory grid shows it.
 *
 * Every display string is composed on the server — `yearsLabel`,
 * `fromPriceLabel` — for the same reason the vehicle card's are: they are the
 * product's own voice, and "from ₹4.2 L" versus "₹4,20,000 onwards" should not
 * be a decision each component author takes again.
 *
 * There is **no phone number here, and no email**. The only route that returns
 * a dealer's number is `POST /v1/vehicles/:id/reveal-contact`, and it is
 * deliberately a POST so it can be rate-limited and logged as a lead
 * (CLAUDE.md rule 7).
 */
export const DealerCard = z.object({
  slug: z.string(),
  brandName: z.string(),
  initials: z.string(),
  city: z.string(),
  state: z.string(),
  yearsOperating: z.number().int(),
  /** Already reads "Vellore, Tamil Nadu · 7 years" — one line, composed once. */
  yearsLabel: z.string(),
  tagline: z.string().nullable(),
  services: z.array(z.string()),
  carCount: z.number().int(),
  fromPricePaise: z.number().int().nullable(),
  /** An em dash when the dealership has no live cars — never "from ₹0". */
  fromPriceLabel: z.string(),
  isVerified: z.boolean(),
  logoUrl: z.string().nullable(),
  coverUrl: z.string().nullable(),
});
export type DealerCard = z.infer<typeof DealerCard>;

/**
 * A place a buyer can filter by, and how many dealerships are in it.
 *
 * The slug is derived from the name — `slugify(dealer.city)` — rather than
 * stored, because **D6** removed the table that used to hold the pair. There is
 * therefore no second copy of it that can fall out of step with the first,
 * which is what that column was for.
 */
export const LocationChip = z.object({
  slug: z.string(),
  name: z.string(),
  count: z.number().int(),
});
export type LocationChip = z.infer<typeof LocationChip>;

/**
 * A district, and **the state it is in** (**R22**).
 *
 * The state is here because the header's selector groups by it, and a grouping
 * the client works out for itself is a second source of truth: there is no rule
 * that turns "Vellore" into "Tamil Nadu" without a table, and D6 removed the
 * table. It comes off the dealership's own `state` column, the same text the
 * portfolio prints under the dealership's name.
 *
 * Nullable rather than absent, because it is: `state` is nullable on the
 * dealership, and a district whose dealerships never filled it in must still be
 * offered — the selector's list is the platform's coverage, and dropping a
 * district for a blank field would quietly delete places a buyer can reach. The
 * UI groups those under a heading that says so.
 *
 * One chip per district **slug**, as before, so the count and the `?district=`
 * filter it sets go on agreeing (§4.11). Two states with a same-named district
 * would therefore share a chip; that is a property of the slug-only URL scheme
 * and not something this schema invents a second answer to.
 */
export const DistrictChip = LocationChip.extend({
  state: z.string().nullable(),
});
export type DistrictChip = z.infer<typeof DistrictChip>;

export const DealerDirectoryResponse = z.object({
  data: z.array(DealerCard),
  page: OffsetPage,
  countLabel: z.string(),
  /**
   * The city chips, **narrowed to the chosen district**. Every town in it that
   * holds a verified dealership, counted over the district rather than over the
   * page — so choosing a chip cannot empty the row it was chosen from.
   */
  cities: z.array(LocationChip),
  /**
   * Every district that holds a verified dealership, and never narrowed by
   * anything. It is what the header's selector offers, and a selector that
   * dropped the options you did not choose is a selector you cannot get out of.
   *
   * Each carries its state (**R22**) — the header groups by it.
   */
  districts: z.array(DistrictChip),
});
export type DealerDirectoryResponse = z.infer<typeof DealerDirectoryResponse>;

/**
 * A12 — the places the platform trades in, for the header's location button.
 *
 * A separate read from the directory's own, because the header sits in the
 * public layout and is rendered on pages that never call `/v1/dealers` — the
 * home page and, from F077, the catalogue. Asking the directory for it would
 * mean every one of those pages fetching a page of dealerships to render a
 * dropdown.
 *
 * ── Deliberate divergence from the baseline ─────────────────────────────────
 * This replaces `CitiesResponse` and `GET /v1/cities` (F026), which **D6**
 * withdrew along with the `cities` table. The difference is not only the name:
 * that endpoint listed the five towns somebody had seeded, and this one lists
 * the districts dealerships are *actually* in, counted. A location filter can
 * therefore never offer a place with nothing behind it.
 * ────────────────────────────────────────────────────────────────────────────
 */
export const PublicLocations = z.object({
  districts: z.array(DistrictChip),
  /** Every ACTIVE dealership, so the "all districts" row can be counted. */
  total: z.number().int(),
  /**
   * The same districts counted in **live cars** rather than dealerships
   * (**R50**), for when the selector is scoping `/cars`.
   *
   * Kept beside the chips rather than inside them: a `DistrictChip` is also a
   * directory payload, and the count it carries is the directory's. `districts`
   * is keyed by the chip's slug and omits a district with nothing live, which
   * reads as zero. The predicate is the marketplace's own
   * (`PUBLIC_LISTING_WHERE`), so this total and `/cars`'s agree.
   */
  cars: z.object({
    total: z.number().int(),
    districts: z.record(z.string(), z.number().int()),
  }),
});
export type PublicLocations = z.infer<typeof PublicLocations>;

/**
 * A9 — one dealership's public page, as a buyer sees it.
 *
 * ## This shape is a privacy boundary
 *
 * `contact` is a list of rows the page renders verbatim, and **none of them is
 * a phone row** (**R16**). There used to be one carrying `masked: true` and the
 * words "Tap to reveal", which was already safe — the number was never in the
 * payload — but the reveal it invited is A7, which is vehicle-scoped, so there
 * was no control on a dealership page that could act on it. Removing the row
 * leaves nothing phone-shaped in this schema at all, which is a boundary a
 * reviewer can check by reading the type.
 *
 * GSTIN is here and PAN is not, and the difference is not squeamishness: a
 * GSTIN is printed on every invoice an Indian business issues and is a thing a
 * buyer can check, while a PAN is the proprietor's tax identity.
 */
export const DealerPublicProfile = z.object({
  slug: z.string(),
  brandName: z.string(),
  legalName: z.string(),
  initials: z.string(),
  isVerified: z.boolean(),
  /**
   * The one line the dealership describes itself in, under its name (**R25**).
   *
   * It replaces `about`, which was the paragraph this page used to open with,
   * and the replacement is a judgement about what a portfolio is read for. The
   * page already says who this is four other ways — the name, the yard
   * photograph, the address, the services — and the paragraph sat above all of
   * them asking to be read first. What a buyer wants from prose here is one
   * line that says what kind of yard this is; the rest of the answer is the
   * inventory below it.
   *
   * `about` is not published anywhere any more. The column is still there and
   * the admin console still reads it, because a hundred dealerships have
   * written into it and nothing is served by destroying that — but no public
   * response carries it, which is a boundary a reviewer can check by reading
   * this type.
   *
   * Nullable, because the dealerships that predate the question have none.
   * The page renders nothing rather than a placeholder line: an empty
   * `<p>` under a heading reads as a rendering fault.
   */
  tagline: z.string().nullable(),
  services: z.array(z.string()),
  address: z.object({
    line: z.string().nullable(),
    city: z.string(),
    district: z.string().nullable(),
    state: z.string(),
    pincode: z.string().nullable(),
    full: z.string(),
    /**
     * The dealer's own Google Maps link, verbatim (**R6**) — the portfolio's
     * "Get directions" is an anchor to this and nothing else.
     *
     * ── Deliberate divergence from the baseline ─────────────────────────────
     * The baseline composed `https://…/dir/?api=1&destination={lat},{lng}`
     * from coordinates copied off a `cities` row. Those coordinates were the
     * town's, not the yard's, and **D6** took the row away. Null on
     * dealerships that predate the question, which is what the page branches
     * on: the button is absent rather than broken, and an address string must
     * never be turned into a Maps URL as a fallback — a typed address is
     * several pins in one district, and the wrong one sends a buyer to
     * somebody else's gate.
     * ────────────────────────────────────────────────────────────────────────
     */
    mapsUrl: z.string().nullable(),
    /**
     * The yard's own coordinates, read out of `mapsUrl` at write time
     * (`platform/maps/maps-link.ts`) — never geocoded from the address above.
     *
     * This is what the location card draws its map at, and the distinction
     * matters: an address is several pins in one district, and a map centred on
     * the wrong one is a more confident lie than no map at all. Null when the
     * dealer's link carried no position and could not be followed to one, and
     * the card then shows the slot it always did.
     *
     * It is deliberately *not* published in `AutoDealer` structured data. These
     * are still coordinates derived from a share link rather than surveyed, and
     * a `GeoCoordinates` block is read by machines that will not check.
     */
    geo: z.object({ lat: z.number(), lng: z.number() }).nullable(),
    /**
     * The map itself, as a URL the location card's `<iframe>` points at.
     *
     * Composed, unlike `mapsUrl` — and composed on the server rather than in
     * the card, because which of the three shapes it takes depends on what the
     * dealer's link turned out to carry, which is a fact the API holds and the
     * page would otherwise have to re-derive.
     *
     * When the link named a **place**, this is Google's `/maps/embed?pb=…`
     * form, and the frame comes back as a place card: the dealership's name,
     * its address, its rating and review count, zoom controls, and a directions
     * control inside the map. When it carried only coordinates, it is the plain
     * `?q=lat,lng&output=embed` dot. Null when it carried neither, and the card
     * shows the slot it always did.
     *
     * Not the same question as `mapsUrl`, which is what "Get directions" opens.
     * A dealership can have one and not the other, and the card renders
     * whichever halves it has — see `platform/maps/maps-link.ts`.
     */
    embedUrl: z.string().nullable(),
  }),
  stats: z.array(z.object({ key: z.string(), label: z.string(), value: z.string() })),
  contact: z.array(
    z.object({
      key: z.string(),
      label: z.string(),
      value: z.string(),
      mono: z.boolean().optional(),
    }),
  ),
  logoUrl: z.string().nullable(),
  coverUrl: z.string().nullable(),
  seo: z.object({ canonical: z.string(), title: z.string(), isIndexable: z.boolean() }),
});
export type DealerPublicProfile = z.infer<typeof DealerPublicProfile>;

// ─────────── A8b — search suggestions ───────────────────────────────────────
/**
 * What every typeahead on the platform asks for (**R43**).
 *
 * One query grammar rather than one per surface, because a suggest endpoint
 * always takes the same three things: the characters typed so far, how many
 * rows to answer with, and — where the page already narrows a set — the filter
 * that narrows it. `/v1/search/vehicles` arrives at **F076** and has no reason
 * to invent a second spelling of `search`.
 *
 * `search` is `.min(1)`: the box calls after one character, and a suggest
 * request with nothing in it is the caller's bug, not an empty result set. It
 * is trimmed first, so a box holding one space is a 400 naming `search` rather
 * than a scan of every dealership on the platform.
 *
 * `.strict()` like every other input here, so `?q=vel` — the *directory's*
 * parameter, which is the one a hand-written call is most likely to reach for
 * — is a 400 that names `q` rather than a silently unfiltered list.
 */
export const SuggestQuery = z
  .object({
    search: z.string().trim().min(1).max(120),
    /**
     * Deliberately small, and capped well below the directory's 48.
     *
     * A dropdown is read, not paged: past about ten rows it stops being a
     * shortlist and becomes a second results page rendered over the first one,
     * and the arrow keys that are the whole point of it become a scroll.
     */
    limit: z.coerce.number().int().min(1).max(10).default(6),
  })
  .strict();
export type SuggestQuery = z.infer<typeof SuggestQuery>;

/**
 * The dealer typeahead's query — `SuggestQuery`, plus the place the directory
 * is already looking at.
 *
 * `district` and `city` are here because the box sits *inside* a filtered page:
 * a buyer who has chosen Vellore and typed "sri" is asking about Vellore, and
 * offering them a Sri Lakshmi Motors in Ernakulam is offering a row that
 * disappears the moment they pick it — the grid behind it is still filtered by
 * district. They take the same shapes `DealerDirectoryQuery` uses, so the box
 * passes the URL's own parameters through rather than re-encoding them.
 */
export const DealerSuggestQuery = SuggestQuery.extend({
  city: z
    .string()
    .regex(/^[a-z0-9-]+(?:,[a-z0-9-]+)*$/)
    .max(400)
    .optional(),
  district: z
    .string()
    .regex(/^[a-z0-9-]+$/)
    .optional(),
}).strict();
export type DealerSuggestQuery = z.infer<typeof DealerSuggestQuery>;

/**
 * One row in the dealer dropdown.
 *
 * **It is not a `DealerCard`.** A card carries a cover photograph, a tagline, a
 * service list and two composed price strings, and every one of those is a
 * field the dropdown would fetch and throw away — six of them per keystroke,
 * against an endpoint that answers while somebody is still typing. So this is
 * the row as drawn: an avatar's letters, a name, one line underneath it.
 *
 * `matchedOn` is what the highlighter marks. The server answers it rather than
 * letting the client re-derive it because the server is what decided the row
 * matched: it is the *reason* the row is in the list, and a client that
 * searches the name for the typed characters would mark nothing at all on a
 * dealership matched by its town.
 *
 * No phone number and no email, like everything else under this tag — and, as
 * on the card, nothing here could hold one (rule 7).
 */
export const DealerSuggestion = z.object({
  slug: z.string(),
  brandName: z.string(),
  initials: z.string(),
  /** "42 cars in yard · Katpadi, Vellore" — composed once, on the server. */
  metaLabel: z.string(),
  /** Which field put this row in the list: what the dropdown marks. */
  matchedOn: z.enum(['brandName', 'city', 'district']),
  carCount: z.number().int(),
  isVerified: z.boolean(),
});
export type DealerSuggestion = z.infer<typeof DealerSuggestion>;

/**
 * The dropdown's payload.
 *
 * `search` is echoed back deliberately. The box fires a request per debounced
 * keystroke and the answers can arrive out of order — a two-character query
 * against a cold cache can land *after* the four-character one that replaced
 * it — so the client compares this against what is in the input and drops
 * anything stale. The abort controller is the first defence; this is the one
 * that works when the request was already on the wire.
 */
export const DealerSuggestResponse = z.object({
  search: z.string(),
  data: z.array(DealerSuggestion),
  /** "4 matching yards" — the dropdown's group header (`DESIGN-SPEC §3.5`). */
  countLabel: z.string(),
});
export type DealerSuggestResponse = z.infer<typeof DealerSuggestResponse>;

// ─────────── Public vehicles (F075, F077, F076) ────────────────────────────
/**
 * The marketplace's query grammar (**F076**).
 *
 * **CSV means OR within a group, and groups are ANDed**: `fuel=petrol,diesel&
 * transmission=automatic` is petrol-or-diesel automatics. One encoding for every
 * multi-select, and the one the directory's `city=` already uses, so a URL is
 * readable and a shared link is short.
 *
 * Every value is a **slug** — lower-case, hyphenated — never a display string.
 * Make, model, colour, town and district are text a dealer typed, so the slug is
 * derived on the server with `slugify`, the same function that keys the facets:
 * whatever the facet offers is exactly what this accepts.
 *
 * `.strict()` like every other input: an unknown parameter is a 400 naming it,
 * never a silently unfiltered page of the whole marketplace.
 */
const splitCsv = (value: string): string[] =>
  value
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part.length > 0);

const csvOf = <T extends z.ZodType<string, string>>(item: T, max = 20) =>
  z.string().max(1200).transform(splitCsv).pipe(z.array(item).min(1).max(max));

const slug = z
  .string()
  .regex(/^[a-z0-9-]+$/)
  .max(80);

/**
 * The fuel, transmission and body values as they appear in a URL: the enum,
 * lower-cased. Spelled out rather than derived so the type is the literal set;
 * `public.test.ts` pins each one to its enum, so a new fuel cannot be added to
 * one and not the other.
 */
export const FuelSlug = z.enum(['petrol', 'diesel', 'cng', 'electric', 'hybrid', 'lpg']);
export type FuelSlug = z.infer<typeof FuelSlug>;
export const TransmissionSlug = z.enum(['manual', 'automatic']);
export type TransmissionSlug = z.infer<typeof TransmissionSlug>;
export const BodyTypeSlug = z.enum(['hatchback', 'sedan', 'suv', 'muv', 'luxury']);
export type BodyTypeSlug = z.infer<typeof BodyTypeSlug>;
export const ColorSlug = z.enum([
  'black',
  'white',
  'grey',
  'silver',
  'red',
  'blue',
  'green',
  'brown',
  'beige',
  'yellow',
  'orange',
  'other',
]);
export type ColorSlug = z.infer<typeof ColorSlug>;

/**
 * Owners, as a buyer asks about them: first, second, third, or **four or more**.
 * `4` is the open-ended bucket, so a fifth-owner car is found under it rather
 * than under nothing.
 */
export const OwnerBucket = z.enum(['1', '2', '3', '4']);
export type OwnerBucket = z.infer<typeof OwnerBucket>;
export const OWNER_BUCKET_MIN = 4;

export const OWNER_BUCKET_LABELS: Record<OwnerBucket, string> = {
  '1': 'First owner',
  '2': 'Second owner',
  '3': 'Third owner',
  '4': 'Fourth owner or more',
};

/**
 * The order a page is read in. Every one ends on the listing id, so a page
 * boundary is stable between two requests that tie on the leading key.
 */
export const VehicleSort = z.enum(['newest', 'price_asc', 'price_desc', 'year_desc', 'km_asc']);
export type VehicleSort = z.infer<typeof VehicleSort>;

export const VEHICLE_SORT_LABELS: Record<VehicleSort, string> = {
  newest: 'Newest first',
  price_asc: 'Price — Low to High',
  price_desc: 'Price — High to Low',
  year_desc: 'Year — Newest first',
  km_asc: 'Kilometers — Low to High',
};

/** Rupees are a UI boundary (rule 3): the price range is paise, like the column. */
const PRICE_MAX_PAISE = 100_000_000_000;
const KM_MAX = 10_000_000;
const YEAR_MIN = 1950;
const YEAR_MAX = 2100;

const VehiclePage = {
  page: z.coerce.number().int().min(1).max(1000).default(1),
  limit: z.coerce.number().int().min(1).max(48).default(24),
};

const VehicleFilters = {
  /**
   * Free text over the make, model, variant and the dealership's trading name.
   * Case-insensitive, whitespace collapsed, and every word must match somewhere
   * — `creta sx` is a Creta in its SX trim, not every Creta and every SX. No
   * registration and nothing else private is searched.
   */
  q: z.string().trim().max(120).optional(),
  brand: csvOf(slug).optional(),
  model: csvOf(slug, 40).optional(),
  minPrice: z.coerce.number().int().min(0).max(PRICE_MAX_PAISE).optional(),
  maxPrice: z.coerce.number().int().min(0).max(PRICE_MAX_PAISE).optional(),
  /** The manufacturing year — the year the card's plate shows (`VehicleCardDto.year`). */
  minYear: z.coerce.number().int().min(YEAR_MIN).max(YEAR_MAX).optional(),
  maxYear: z.coerce.number().int().min(YEAR_MIN).max(YEAR_MAX).optional(),
  minKm: z.coerce.number().int().min(0).max(KM_MAX).optional(),
  maxKm: z.coerce.number().int().min(0).max(KM_MAX).optional(),
  fuel: csvOf(FuelSlug).optional(),
  transmission: csvOf(TransmissionSlug).optional(),
  bodyType: csvOf(BodyTypeSlug).optional(),
  color: csvOf(ColorSlug).optional(),
  owners: csvOf(OwnerBucket).optional(),
  sort: VehicleSort.default('newest'),
};

const RANGES = [
  ['minPrice', 'maxPrice', 'price'],
  ['minYear', 'maxYear', 'year'],
  ['minKm', 'maxKm', 'kilometers'],
] as const;

/**
 * A range whose floor is above its ceiling is a 400 that names the floor, not
 * an empty page: the second is indistinguishable from "nothing matches", and
 * the first is a client bug somebody should hear about.
 */
function rangesInOrder(
  value: Partial<Record<(typeof RANGES)[number][0 | 1], number>>,
  context: z.RefinementCtx,
): void {
  for (const [min, max, label] of RANGES) {
    const low = value[min];
    const high = value[max];
    if (low !== undefined && high !== undefined && low > high) {
      context.addIssue({
        code: 'custom',
        path: [min],
        message: `The minimum ${label} is above the maximum ${label}.`,
      });
    }
  }
}

/**
 * `/v1/vehicles` — the whole marketplace (**F076**), scoped by **district**
 * (**R50**) and, inside it, by **town** and **dealership**. All three are
 * facts about the dealership: a car has no location of its own.
 */
export const PublicVehicleQuery = z
  .object({
    ...VehiclePage,
    district: slug.optional(),
    city: csvOf(slug).optional(),
    dealer: csvOf(
      z
        .string()
        .regex(/^[a-z0-9-]+$/)
        .max(160),
      40,
    ).optional(),
    ...VehicleFilters,
  })
  .strict()
  .superRefine(rangesInOrder);
export type PublicVehicleQuery = z.infer<typeof PublicVehicleQuery>;

/**
 * `/v1/dealers/:slug/vehicles` — one dealership's live cars, through the same
 * search. No `district`, `city` or `dealer`: the dealership already fixes all
 * three, so any of them could only agree with it or empty the page.
 */
export const DealerVehicleQuery = z
  .object({ ...VehiclePage, ...VehicleFilters })
  .strict()
  .superRefine(rangesInOrder);
export type DealerVehicleQuery = z.infer<typeof DealerVehicleQuery>;

/**
 * The car typeahead's query (**R54**) — `SuggestQuery`, plus the place the
 * marketplace is already looking at, in the same shapes `PublicVehicleQuery`
 * takes them, so the box passes the URL's own parameters through.
 *
 * Only the place, not the other filters: a suggestion *replaces* the brand and
 * model a buyer has chosen, so counting it under them would hide exactly the
 * rows a buyer is typing to reach.
 */
export const CarSuggestQuery = SuggestQuery.extend({
  district: slug.optional(),
  city: csvOf(slug).optional(),
  dealer: csvOf(
    z
      .string()
      .regex(/^[a-z0-9-]+$/)
      .max(160),
    40,
  ).optional(),
}).strict();
export type CarSuggestQuery = z.infer<typeof CarSuggestQuery>;

/**
 * What a car suggestion names. Each is a filter the marketplace already has, so
 * choosing one writes canonical parameters rather than free text: a **brand**
 * is `brand=`, a **model** is `brand=` and `model=`, and a **variant** — which
 * has no filter of its own — is its model plus the variant as `q`.
 */
export const CarSuggestionKind = z.enum(['BRAND', 'MODEL', 'VARIANT']);
export type CarSuggestionKind = z.infer<typeof CarSuggestionKind>;

/**
 * One row in the car dropdown — the row as drawn and the parameters it writes,
 * and nothing about any one car: no price, no photograph, no dealership.
 */
export const CarSuggestion = z.object({
  kind: CarSuggestionKind,
  /** "Hyundai Creta SX(O)" — the make, model and variant this row names. */
  label: z.string(),
  /** "Model · 12 cars" — composed once, on the server. */
  metaLabel: z.string(),
  /** The brand's slug, as `brand=` takes it. */
  brand: z.string(),
  /** The model's slug, as `model=` takes it; `null` on a brand. */
  model: z.string().nullable(),
  /** The variant as the dealer wrote it, written to `q`; `null` above a variant. */
  variant: z.string().nullable(),
  /** The live cars in scope this row leads to. */
  count: z.number().int(),
});
export type CarSuggestion = z.infer<typeof CarSuggestion>;

/** The dropdown's payload — `search` echoed for the stale-answer check, as on the dealers'. */
export const CarSuggestResponse = z.object({
  search: z.string(),
  data: z.array(CarSuggestion),
  countLabel: z.string(),
});
export type CarSuggestResponse = z.infer<typeof CarSuggestResponse>;

/**
 * The presets a buyer picks a price or a distance from. A band is a pair of
 * **inclusive** bounds, the same `min`/`max` the query takes, so choosing one
 * is writing two parameters — and a band's count is exactly the page it leads
 * to. `null` is open-ended.
 */
export interface RangePreset {
  min: number | null;
  max: number | null;
  label: string;
}

const LAKH_PAISE = 10_000_000;

export const PRICE_PRESETS: readonly RangePreset[] = [
  { min: null, max: 5 * LAKH_PAISE, label: 'Under ₹5 lakh' },
  { min: 5 * LAKH_PAISE, max: 10 * LAKH_PAISE, label: '₹5–10 lakh' },
  { min: 10 * LAKH_PAISE, max: 15 * LAKH_PAISE, label: '₹10–15 lakh' },
  { min: 15 * LAKH_PAISE, max: 20 * LAKH_PAISE, label: '₹15–20 lakh' },
  { min: 20 * LAKH_PAISE, max: null, label: '₹20 lakh+' },
];

export const KM_PRESETS: readonly RangePreset[] = [
  { min: null, max: 20_000, label: 'Under 20,000 km' },
  { min: 20_000, max: 40_000, label: '20,000–40,000 km' },
  { min: 40_000, max: 60_000, label: '40,000–60,000 km' },
  { min: 60_000, max: 100_000, label: '60,000–1,00,000 km' },
  { min: 100_000, max: null, label: '1,00,000+ km' },
];

/**
 * One value a buyer can tick, and how many cars ticking it would show.
 *
 * `value` is what goes in the URL; `label` is how the platform spells it — for
 * text a dealer typed, the most common spelling among the cars it counts.
 * `parent` is set on a model and names its brand's slug, so a client can drop
 * the models of a brand that has just been unticked.
 */
export const FacetOption = z.object({
  value: z.string(),
  label: z.string(),
  count: z.number().int(),
  parent: z.string().optional(),
});
export type FacetOption = z.infer<typeof FacetOption>;

export const RangeFacet = z.object({
  min: z.number().int().nullable(),
  max: z.number().int().nullable(),
  label: z.string(),
  count: z.number().int(),
});
export type RangeFacet = z.infer<typeof RangeFacet>;

/**
 * What the current inventory offers, counted (**F076**).
 *
 * ## The semantics, which are the standard ones and deliberately so
 *
 * Each group is counted under **every active filter except its own**. Ticking
 * Petrol therefore leaves Diesel's count where it was — the number of cars
 * ticking Diesel *as well* would add — so a multi-select stays usable; counting
 * a group under itself would zero every sibling of the first box ticked.
 *
 * Three groups are **dependent**, and that is where the exceptions are:
 *
 *   · **brand** is counted without the model filter either, because a model
 *     belongs to a brand and ticking Creta must not hide Kia;
 *   · **model** is counted *with* the brand filter, and is empty until a brand
 *     is ticked — Creta, Venue, i20 under Hyundai, never Swift;
 *   · **cities** exist only inside a district; with every district in scope
 *     they are empty rather than every town on the platform.
 *
 * Only values with inventory behind them are listed. A value that is in the
 * query but has nothing behind it is still listed, with a count of zero, so it
 * can be seen and unticked rather than silently filtering the page to nothing.
 *
 * Every count means **available**: the public rule (`PUBLIC_LISTING_WHERE`) is
 * the base of every one of them.
 */
export const VehicleFacets = z.object({
  cities: z.array(FacetOption),
  brands: z.array(FacetOption),
  models: z.array(FacetOption),
  fuelTypes: z.array(FacetOption),
  transmissions: z.array(FacetOption),
  bodyTypes: z.array(FacetOption),
  colors: z.array(FacetOption),
  ownerCounts: z.array(FacetOption),
  dealers: z.array(FacetOption),
  /** Every manufacturing year with a car behind it, newest first. */
  years: z.array(FacetOption),
  price: z.array(RangeFacet),
  kilometers: z.array(RangeFacet),
});
export type VehicleFacets = z.infer<typeof VehicleFacets>;

/** Nothing offered: what a page with no inventory — or no API — has to filter by. */
export const NO_VEHICLE_FACETS: VehicleFacets = {
  cities: [],
  brands: [],
  models: [],
  fuelTypes: [],
  transmissions: [],
  bodyTypes: [],
  colors: [],
  ownerCounts: [],
  dealers: [],
  years: [],
  price: [],
  kilometers: [],
};

export const PublicVehicleImage = z.object({
  /** A public media URL at the card width; never a storage key or bucket. */
  url: z.string(),
  alt: z.string(),
});
export type PublicVehicleImage = z.infer<typeof PublicVehicleImage>;

/**
 * One vehicle on the marketplace, as a buyer's card shows it (**F075**).
 *
 * Only an ACTIVE listing of an ACTIVE dealership ever becomes one. It carries
 * the public `slug` and nothing internal: no listing, vehicle or dealer id, no
 * registration number, no moderation or audit field, no phone number.
 */
export const VehicleCardDto = z.object({
  slug: z.string(),
  title: z.string(),
  year: z.number().int().nullable(),
  priceLabel: z.string().nullable(),
  metaLabel: z.string(),
  image: PublicVehicleImage.nullable(),
  imageCount: z.number().int(),
  dealer: z.object({
    name: z.string(),
    slug: z.string(),
    initials: z.string(),
    isVerified: z.boolean(),
  }),
});
export type VehicleCardDto = z.infer<typeof VehicleCardDto>;

export const PublicVehiclesResponse = z.object({
  data: z.array(VehicleCardDto),
  page: OffsetPage,
  facets: VehicleFacets,
});
export type PublicVehiclesResponse = z.infer<typeof PublicVehiclesResponse>;

/** A listing's public address, as `/car/{slug}` carries it back in (**F082**). */
export const VehicleSlugParam = z
  .object({
    slug: z
      .string()
      .regex(/^[a-z0-9-]+$/)
      .min(1)
      .max(160),
  })
  .strict();
export type VehicleSlugParam = z.infer<typeof VehicleSlugParam>;

/**
 * One vehicle's public page (**F082** as scoped by **R45**).
 *
 * Only an ACTIVE listing of an ACTIVE dealership has one; anything else is a
 * 404. The registration appears only as its RTO — the full number identifies
 * the owner, not the car, and a buyer does not need it to decide to enquire.
 * Like the card, it carries no internal id, moderation field, storage key or
 * phone number.
 */
export const PublicVehicleDetail = z.object({
  slug: z.string(),
  title: z.string(),
  year: z.number().int().nullable(),
  priceLabel: z.string().nullable(),
  negotiabilityLabel: z.string().nullable(),
  summary: z.string(),
  description: z.string().nullable(),
  specs: z.array(z.object({ label: z.string(), value: z.string() })),
  /** In the admin's gallery order. */
  images: z.array(PublicVehicleImage),
  /** Index of the primary image in `images`, the one shown first; 0 when empty. */
  primaryIndex: z.number().int(),
  publishedLabel: z.string().nullable(),
  dealer: z.object({
    name: z.string(),
    slug: z.string(),
    initials: z.string(),
    isVerified: z.boolean(),
    location: z.string().nullable(),
  }),
});
export type PublicVehicleDetail = z.infer<typeof PublicVehicleDetail>;
