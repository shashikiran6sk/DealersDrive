import {
  distinctServices,
  formatLakh,
  initialsOf,
  type DealerCard,
  type DealerDirectoryQuery,
  type DealerDirectoryResponse,
  type DealerPublicProfile,
  type DistrictChip,
  type LocationChip,
  type PublicLocations,
} from '@dealers-drive/contracts';

import { env } from '../../config/env.js';
import { NotFoundError } from '../../platform/errors.js';
import { embedUrlFor } from '../../platform/maps/maps-link.js';
import { mediaUrl } from '../../platform/media/urls.js';
import type { DealersRepository } from './dealers.repository.js';

/**
 * One dealership's live inventory, as the directory needs to count it.
 *
 * ── Reconstruction slice ────────────────────────────────────────────────────
 * The baseline read this straight off `search.dealerStats()`, which groups
 * `listing_search` — the read model **F064** creates and **F076** queries.
 * Neither exists yet, so this feature declares the shape it needs and takes it
 * as a dependency rather than reaching for a module that is not there.
 *
 * `noInventoryYet` below is the implementation until F076: no listings exist,
 * so every dealership genuinely has none, and the honest answer is zero. The
 * directory already renders that case — a dealership with no live cars appears
 * with an em dash rather than being hidden (A8) — so nothing here is a
 * placeholder waiting to be redesigned. F076 replaces one function.
 * ────────────────────────────────────────────────────────────────────────────
 */
export interface DealerInventoryStat {
  dealer_slug: string;
  count: number;
  from_price: bigint | null;
}

export interface DealerInventoryStats {
  dealerStats(): Promise<DealerInventoryStat[]>;
}

/** No listings exist before F064. Zero is the truth, not a stub. */
export const noInventoryYet: DealerInventoryStats = {
  dealerStats: () => Promise.resolve([]),
};

/**
 * The widths the two public surfaces ask for.
 *
 * `DirectoryCard`'s cover is a 104px band across a ~290px card, so 640 is one
 * retina step above what it needs and the smallest rendition that does not
 * soften on a phone. The portfolio's is a 170px band across the full 1280px
 * column, which is the one place a yard photograph is looked *at* rather than
 * glanced past.
 */
const CARD_COVER_WIDTH = 640;
const PORTFOLIO_COVER_WIDTH = 1600;

export interface DealersPublicDeps {
  repo: DealersRepository;
  stats: DealerInventoryStats;
}

/** A8–A9. Nothing here returns a phone number; A7 is the only route that can. */
export function createDealersPublicService({ repo, stats }: DealersPublicDeps) {
  return {
    /**
     * A8 — the grid, its city chips and its count.
     *
     * Filtering, searching and paging happen in this process rather than in the
     * query, which is the baseline's shape and is deliberate at this size: the
     * directory is every ACTIVE dealership on the platform, the city chips need
     * a count over the *unfiltered* set, and one ordered read serves all three.
     * The day that stops being true is the day the chips need their own query,
     * not the day this gets a `WHERE` clause bolted onto it.
     */
    async directory(query: DealerDirectoryQuery): Promise<DealerDirectoryResponse> {
      const [dealers, inventory] = await Promise.all([repo.listActive(), stats.dealerStats()]);

      const byDealer = new Map(inventory.map((row) => [row.dealer_slug, row]));

      // The district first: it is the wider filter, and the city chips are
      // counted over what it leaves.
      const inDistrict =
        query.district && query.district !== 'all'
          ? dealers.filter((dealer) => dealer.districtSlug === query.district)
          : dealers;

      const cities = citySlugsIn(query.city);

      let filtered = inDistrict;
      if (cities.size > 0) {
        filtered = filtered.filter(
          (dealer) => dealer.citySlug !== null && cities.has(dealer.citySlug),
        );
      }
      if (query.q) {
        const needle = query.q.toLowerCase();
        filtered = filtered.filter((dealer) => dealer.brandName.toLowerCase().includes(needle));
      }

      const total = filtered.length;
      const start = (query.page - 1) * query.limit;
      const paged = filtered.slice(start, start + query.limit);

      // Asked for the page, not for the directory: 24 ids rather than every
      // ACTIVE dealership's, and one query rather than one per card.
      const covers = await repo.readyMediaIds(
        paged.map((dealer) => dealer.coverMediaId).filter((id): id is string => id !== null),
      );

      const data: DealerCard[] = paged.map((dealer) => {
        const stat = byDealer.get(dealer.slug);
        const fromPrice =
          stat?.from_price === null || stat?.from_price === undefined
            ? null
            : Number(stat.from_price);
        const city = dealer.cityName ?? '';
        const state = dealer.state ?? '';

        return {
          slug: dealer.slug,
          brandName: dealer.brandName,
          initials: dealer.initials,
          city,
          state,
          yearsOperating: dealer.yearsOperating,
          yearsLabel: locationLabel(city, state, dealer.yearsOperating),
          tagline: dealer.tagline,
          /*
           * Collapsed on the way out as well as on the way in (**R18**). The
           * write path is where a duplicate stops being created; this is what
           * covers the rows that already hold one, because nothing backfills
           * the column and a card that shows "Finance" twice reads as a fault
           * of the page rather than of the data. Collapse before the slice, so
           * a dealership whose first four entries are three distinct services
           * still gets three chips.
           */
          services: distinctServices(dealer.specialities).slice(0, 3),
          carCount: stat?.count ?? 0,
          fromPricePaise: fromPrice,
          // A dealer with zero live cars still appears, with an em dash (A8).
          fromPriceLabel: fromPrice === null ? '—' : `from ${formatLakh(fromPrice)}`,
          isVerified: true,
          /*
           * No logo yet: nothing in the product writes `logoMediaId`, so there
           * is no image to address. `DirectoryCard` renders the initials tile,
           * which is the design's answer for a dealership without one rather
           * than a gap waiting on a feature.
           */
          logoUrl: null,
          /*
           * The yard photograph, addressed by media id and width — never by
           * storage key, so this URL survives the bucket being reorganised
           * (`platform/media/urls.ts`).
           *
           * Null unless the row is READY. A `coverMediaId` pointing at a
           * PENDING or ORPHAN upload would render as a broken image, and the
           * `ImageSlot` it replaces is the more honest answer.
           */
          coverUrl:
            dealer.coverMediaId && covers.has(dealer.coverMediaId)
              ? mediaUrl(dealer.coverMediaId, CARD_COVER_WIDTH)
              : null,
        };
      });

      return {
        data,
        page: {
          page: query.page,
          limit: query.limit,
          total,
          totalPages: Math.ceil(total / query.limit),
        },
        countLabel: `${total} verified ${total === 1 ? 'dealership' : 'dealerships'}`,
        /*
         * The chips, over the **district** and not over the page — so choosing
         * one cannot empty the row it was chosen from, and a district's towns
         * stay visible while its dealerships are being filtered by name.
         *
         * Narrowed by the district and by nothing else. Narrowing them by the
         * cities already chosen would delete the chips a buyer needs in order
         * to change their mind.
         */
        cities: chipsOf(inDistrict, cityChip),
        /*
         * The districts, over every ACTIVE dealership. Never narrowed: this is
         * what the header offers, and a selector that dropped the options you
         * did not pick is one you cannot get back out of.
         */
        districts: chipsOf(dealers, districtChip),
      };
    },

    /**
     * A12 — the districts the platform trades in, for the header's selector.
     *
     * Its own read rather than a slice of the directory's, because the header
     * is in the public layout: it renders on the home page and on the
     * catalogue, neither of which has any reason to fetch a page of
     * dealerships.
     */
    async locations(): Promise<PublicLocations> {
      const dealers = await repo.listActive();

      return {
        districts: chipsOf(dealers, districtChip),
        total: dealers.length,
      };
    },

    /** A9 — the dealership's own page. `findPublicBySlug` refuses anything but ACTIVE. */
    async profile(slug: string): Promise<DealerPublicProfile> {
      const dealer = await repo.findPublicBySlug(slug);
      if (!dealer) throw new NotFoundError('That dealership is not listed.');

      const [inventory, covers] = await Promise.all([
        stats.dealerStats(),
        repo.readyMediaIds(dealer.coverMediaId ? [dealer.coverMediaId] : []),
      ]);
      const carCount = inventory.find((row) => row.dealer_slug === slug)?.count ?? 0;

      const city = dealer.city ?? '';
      const state = dealer.state ?? '';
      const yearsOperating = dealer.establishedYear
        ? Math.max(1, new Date().getUTCFullYear() - dealer.establishedYear)
        : 1;

      const fullAddress = [dealer.addressLine, `${city} ${dealer.pincode ?? ''}`.trim(), state]
        .filter(Boolean)
        .join(', ');

      const hours = dealer.workingHours as { mon_sat?: string; sun?: string | null } | null;

      return {
        slug: dealer.slug,
        brandName: dealer.brandName,
        legalName: dealer.legalName,
        initials: initialsOf(dealer.brandName),
        isVerified: true,
        about: dealer.about,
        // As on the card, and for the same reason (**R18**) — the portfolio
        // renders one tag per service and keys it by the string.
        services: distinctServices(dealer.specialities),
        address: {
          line: dealer.addressLine,
          city,
          district: dealer.district,
          state,
          pincode: dealer.pincode,
          full: fullAddress,
          // R6, with the one exception `directionsUrl` explains.
          mapsUrl: directionsUrl(dealer.mapsUrl, dealer.lat, dealer.lng),
          // The pin the link resolved to, when it resolved to one. Both halves
          // have to be present: a row with a latitude and no longitude is not a
          // place, and centring a map on half a coordinate puts it in the sea.
          geo:
            dealer.lat === null || dealer.lng === null
              ? null
              : { lat: dealer.lat, lng: dealer.lng },
          /*
           * The map the card draws, composed from whatever the dealer's link
           * turned out to carry — the place card when it named a place, the
           * plain pin when it only placed one, null when it did neither.
           *
           * Composed here rather than in the card because the choice between
           * those three is a question about the stored link, and the card
           * would have to re-parse the link to ask it. `embedUrlFor` is in
           * `platform/maps` with the rest of the Maps URL grammar.
           */
          embedUrl: embedUrlFor({
            mapsUrl: dealer.mapsUrl,
            placeId: dealer.mapsPlaceId,
            coordinates:
              dealer.lat === null || dealer.lng === null
                ? null
                : { lat: dealer.lat, lng: dealer.lng },
            label: dealer.brandName,
          }),
        },
        stats: [
          { key: 'cars', label: 'Cars available', value: String(carCount) },
          { key: 'years', label: 'Years operating', value: String(yearsOperating) },
          { key: 'location', label: 'Location', value: city },
          {
            key: 'response',
            label: 'Response time',
            value: responseLabel(dealer.medianResponseMins),
          },
        ],
        contact: [
          /*
           * No phone row at all (**R16**). It said "Tap to reveal" and carried
           * no digits, which was safe — but nothing on this page can act on it:
           * A7 is vehicle-scoped, so the button that would reveal a number
           * belongs to a listing and not to a dealership. An invitation with
           * nothing behind it reads as a control a buyer failed to find.
           *
           * Rule 7 is unchanged and, if anything, easier to hold: there is now
           * no phone-shaped row in this payload at all.
           */
          { key: 'city', label: 'City', value: [city, state].filter(Boolean).join(', ') },
          // GSTIN is public — it is on every Indian invoice. PAN never is.
          ...(dealer.gstin
            ? [{ key: 'gstin', label: 'GSTIN', value: dealer.gstin, mono: true }]
            : []),
          ...(hours?.mon_sat
            ? [{ key: 'hours', label: 'Open', value: humanHours(hours.mon_sat) }]
            : []),
        ],
        // As above: no logo is written anywhere yet, and the cover is a URL only
        // once its bytes are actually servable.
        logoUrl: null,
        coverUrl:
          dealer.coverMediaId && covers.has(dealer.coverMediaId)
            ? mediaUrl(dealer.coverMediaId, PORTFOLIO_COVER_WIDTH)
            : null,
        seo: {
          canonical: `${env.WEB_BASE_URL}/dealers/${dealer.slug}`,
          // Indexable only if ACTIVE and holding at least one live listing
          // (§17.2). Every dealership is therefore noindex until F064 — which
          // is right: a portfolio with nothing in it is a page Google should
          // not be sent to, and this is the condition that says so.
          isIndexable: carCount > 0,
          title: city
            ? `${dealer.brandName} — used cars in ${city} | Dealers-Drive`
            : `${dealer.brandName} — used cars | Dealers-Drive`,
        },
      };
    },
  };
}

export type DealersPublicService = ReturnType<typeof createDealersPublicService>;

/**
 * What "Get directions" should actually open.
 *
 * **R6 stores the dealer's link verbatim and this returns it verbatim**, with
 * one exception: an *embed* URL. `google.com/maps/embed?pb=…` is the src of the
 * iframe Google's Share → Embed panel hands out, and dealers paste it because
 * it is what a "put a map on your site" tutorial tells them to copy. It draws a
 * perfectly good map — the pin is in the `pb` blob — but opened as a link it is
 * a bare embedded map with no place card and no directions.
 *
 * So when that is what was pasted, the button is built from **the dealership's
 * own pin**, which is the same pin that URL contains. This is not the thing R6
 * forbids: the prohibition is on composing a destination out of a *typed
 * address*, because an address is several gates in one district. These
 * coordinates came from the dealer's own link.
 *
 * No pin, or any other kind of link: verbatim, as before.
 */
function directionsUrl(
  mapsUrl: string | null,
  lat: number | null,
  lng: number | null,
): string | null {
  if (!mapsUrl) return null;
  if (lat === null || lng === null) return mapsUrl;

  let path: string;
  try {
    path = new URL(mapsUrl).pathname;
  } catch {
    // A row written before the URL was validated. Not this function's problem.
    return mapsUrl;
  }

  if (!path.startsWith('/maps/embed')) return mapsUrl;
  return `https://www.google.com/maps/dir/?api=1&destination=${String(lat)},${String(lng)}`;
}

/**
 * `?city=vellore,katpadi` — the chips a buyer has toggled on.
 *
 * `all` is accepted as "no filter" rather than as a town, because that is what
 * the baseline's single-select chip sent when it was cleared and a link that
 * still says it should not return an empty page.
 */
function citySlugsIn(value: string | undefined): Set<string> {
  if (!value) return new Set();
  return new Set(
    value
      .split(',')
      .map((slug) => slug.trim())
      .filter((slug) => slug.length > 0 && slug !== 'all'),
  );
}

/**
 * Counts one place per dealership, busiest first, dropping the rows that never
 * answered the question.
 *
 * One function for the city chips and the district selector because they are
 * the same computation over a different column — and they were the same
 * fourteen lines twice before this, which is how the two come to disagree about
 * whether an unnamed locality is a chip.
 *
 * `chip` returns the row the place *would* contribute, or `null` when the row
 * never named one. Generic in the chip rather than in the tuple so the district
 * list can carry its state (**R22**) through the same counting, ordering and
 * dropping rules as the towns, instead of a second copy of them.
 */
function chipsOf<T, C extends LocationChip>(rows: readonly T[], chip: (row: T) => C | null): C[] {
  const chips = new Map<string, C>();

  for (const row of rows) {
    const made = chip(row);
    if (!made) continue;
    const existing = chips.get(made.slug);
    if (existing) existing.count += 1;
    else chips.set(made.slug, made);
  }

  // Busiest first, then alphabetically — otherwise two districts of the same
  // size swap places between requests and the row appears to shuffle itself.
  return [...chips.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

/** A town chip, or `null` for a dealership that never named its town. */
function cityChip(row: { citySlug: string | null; cityName: string | null }): LocationChip | null {
  return row.citySlug && row.cityName ? { slug: row.citySlug, name: row.cityName, count: 1 } : null;
}

/**
 * A district chip, carrying the state it is in (**R22**) — which is what lets
 * the header group `Vellore` under `Tamil Nadu` without working the pairing out
 * for itself.
 *
 * The state is whatever the **first** dealership counted into the chip typed,
 * and it is null when that dealership left the field blank. Neither case drops
 * the district: the selector's list is the platform's coverage, and a district
 * that vanished because somebody skipped a form field is a place a buyer can no
 * longer reach.
 */
function districtChip(row: {
  districtSlug: string | null;
  districtName: string | null;
  state: string | null;
}): DistrictChip | null {
  return row.districtSlug && row.districtName
    ? { slug: row.districtSlug, name: row.districtName, count: 1, state: row.state }
    : null;
}

/**
 * "Vellore, Tamil Nadu · 7 years", and gracefully less when a dealership
 * predates one of the fields. The baseline built this inline and produced
 * ", Tamil Nadu · 1 years" for a row with no city — a string a buyer sees.
 */
function locationLabel(city: string, state: string, years: number): string {
  const place = [city, state].filter(Boolean).join(', ');
  const age = `${years} ${years === 1 ? 'year' : 'years'}`;
  return place ? `${place} · ${age}` : age;
}

/**
 * A dealer who never touches their inbox degrades their own public stat.
 * That feedback loop is intentional (§14.3).
 */
function responseLabel(medianMins: number | null): string {
  if (medianMins === null) return 'New dealer';
  if (medianMins < 60) return '< 1 hr';
  if (medianMins < 120) return '< 2 hrs';
  if (medianMins < 60 * 24) return `< ${Math.ceil(medianMins / 60)} hrs`;
  return '> 1 day';
}

function humanHours(range: string): string {
  const [from, to] = range.split('-');
  return `Mon–Sat, ${clock(from)} – ${clock(to)}`;
}

function clock(value: string | undefined): string {
  if (!value) return '';
  const [hourText, minuteText] = value.split(':');
  const hour = Number(hourText);
  const suffix = hour >= 12 ? 'pm' : 'am';
  const display = hour % 12 === 0 ? 12 : hour % 12;
  return minuteText === '00' ? `${display}${suffix}` : `${display}:${minuteText}${suffix}`;
}
