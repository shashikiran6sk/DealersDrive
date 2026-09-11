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
  /** OTP transport is server-side; no provider credentials reach the browser. */
  phoneVerificationEnabled: z.boolean(),
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
