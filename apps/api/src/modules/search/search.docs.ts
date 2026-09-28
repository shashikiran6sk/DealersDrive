import type { ModuleDocs } from '../../docs/spec.js';
import { DOC_TAGS } from '../../docs/tags.js';

const CARD_EXAMPLE = {
  slug: '2023-hyundai-creta-sx-o-katpadi-3f9a1c2b',
  title: '2023 Hyundai Creta SX(O)',
  year: 2023,
  priceLabel: '₹14,50,000',
  metaLabel: '22,400 km · Petrol · Automatic · Katpadi',
  image: {
    url: 'http://localhost:4000/media/by-media/bc7de20d-30a4-41ed-a364-8f34771a20a8/640.webp',
    alt: '2023 Hyundai Creta SX(O), the primary photograph',
  },
  imageCount: 8,
  dealer: {
    name: 'Sri Lakshmi Motors',
    slug: 'sri-lakshmi-motors-katpadi',
    initials: 'SL',
    isVerified: true,
  },
};

const FACETS_EXAMPLE = {
  cities: [
    { value: 'arcot', label: 'Arcot', count: 18 },
    { value: 'arakkonam', label: 'Arakkonam', count: 14 },
  ],
  brands: [
    { value: 'hyundai', label: 'Hyundai', count: 11 },
    { value: 'tata', label: 'Tata', count: 8 },
  ],
  models: [{ value: 'creta', label: 'Creta', count: 5, parent: 'hyundai' }],
  fuelTypes: [
    { value: 'petrol', label: 'Petrol', count: 20 },
    { value: 'diesel', label: 'Diesel', count: 10 },
  ],
  transmissions: [{ value: 'automatic', label: 'Automatic', count: 12 }],
  bodyTypes: [{ value: 'suv', label: 'SUV', count: 15 }],
  colors: [
    { value: 'black', label: 'Black', count: 4 },
    { value: 'white', label: 'White', count: 6 },
  ],
  ownerCounts: [{ value: '1', label: 'First owner', count: 21 }],
  dealers: [{ value: 'sri-lakshmi-motors-arcot', label: 'Sri Lakshmi Motors', count: 9 }],
  years: [{ value: '2023', label: '2023', count: 7 }],
  price: [{ min: null, max: 50_000_000, label: 'Under ₹5 lakh', count: 6 }],
  kilometers: [{ min: null, max: 20_000, label: 'Under 20,000 km', count: 4 }],
};

const SEARCH_DESCRIPTION =
  '**Filters.** Multi-select values are comma-separated and ORed within a group; groups are ' +
  'ANDed (`fuel=petrol,diesel&transmission=automatic`). Every value is a slug, exactly as ' +
  'the matching facet offers it. `minPrice`/`maxPrice` are **paise**, inclusive; ' +
  '`minYear`/`maxYear` are the manufacturing year the card shows; `minKm`/`maxKm` are ' +
  'kilometres. A floor above its ceiling is a 400 naming the floor. `owners=4` means four or ' +
  'more. `q` matches every word against the make, model, variant and dealership name, ' +
  'case-insensitively — never the registration.\n\n' +
  '**Sort.** `newest` (default), `price_asc`, `price_desc`, `year_desc`, `km_asc`; a car ' +
  'missing the sort key comes last, and every sort ends on the approval date and the id so ' +
  'pages are stable.\n\n' +
  '**Facets.** Each group is counted under every filter except its own, so ticking Petrol ' +
  'leaves Diesel\u2019s count as what ticking it too would add. `brands` ignores the model ' +
  'filter as well; `models` is empty until a brand is chosen and carries its brand as ' +
  '`parent`. `colors` is always the twelve generic families (**R52**), in order, zeros ' +
  'included. A ticked value with nothing behind it is still listed, at zero. `price` and ' +
  '`kilometers` count fixed presets whose bounds are the query\u2019s own parameters. All ' +
  'counts are of public cars only.';

export const searchDocs: ModuleDocs = {
  tag: DOC_TAGS.vehiclesPublic,
  description:
    'The public marketplace (**F075**, **F077**, as scoped by **R45**). No session.\n\n' +
    '**Two public rules (R71).** A listing is *visible* when it is `ACTIVE` or `RESERVED` and ' +
    'its dealership is `ACTIVE`; it is *available* only when `ACTIVE`. Search results and the ' +
    'detail page return visible listings, each card carrying `availability` (`AVAILABLE` or ' +
    '`RESERVED`), with reserved cars sorted after available ones. Every count that means ' +
    'stock — the facets, `available`, the directory’s car counts, suggestions — counts ' +
    'available cars only. A draft, a listing in review, one sent back, rejected, sold or ' +
    'withdrawn, and every listing of a suspended dealership, is absent. A vehicle is addressed by its public ' +
    '`slug`; no internal id, registration number, moderation or audit field, storage key or ' +
    'dealer phone number appears in any response here.',
  operations: [
    {
      method: 'get',
      path: '/v1/vehicles',
      operationId: 'listPublicVehicles',
      tag: DOC_TAGS.vehiclesPublic,
      summary: 'The vehicles on the marketplace',
      description:
        'The marketplace search (**F076**): a page of cards (offset pagination, 1–48 per ' +
        'page, newest approval first unless sorted), the total, and the facets. `district` ' +
        'scopes the list to the dealerships in one district — the same slug the directory ' +
        'and `GET /v1/locations` use; an unknown district is an empty page, not an error ' +
        '(**R50**). `city` and `dealer` narrow inside it; `cities` is offered only once a ' +
        'district is chosen.\n\n' +
        SEARCH_DESCRIPTION +
        '\n\nEach ' +
        'card carries the primary image as a public media URL, or `null` if none could be ' +
        'served. Cached publicly for a minute and rate-limited per IP like every public read.',
      audience: 'public',
      query: 'PublicVehicleQuery',
      responses: [
        {
          status: 200,
          description: 'A page of vehicle cards.',
          schema: 'PublicVehiclesResponse',
          example: {
            data: [CARD_EXAMPLE],
            page: { page: 1, limit: 24, total: 1, totalPages: 1 },
            facets: FACETS_EXAMPLE,
          },
        },
      ],
      errors: [400, 429],
    },
    {
      method: 'get',
      path: '/v1/vehicles/:slug',
      operationId: 'getPublicVehicle',
      tag: DOC_TAGS.vehiclesPublic,
      summary: 'One vehicle\u2019s public page',
      description:
        'The vehicle detail page (**F082** as scoped by **R45**): title, price, the ' +
        'specifications, the dealer\u2019s description, every image in the admin\u2019s ' +
        'gallery order with `primaryIndex` naming the one to show first, and the dealership.\n\n' +
        '**A reserved car has a page** (**R71**), with `availability: RESERVED`; the page offers ' +
        'no enquiry. **A listing that is neither `ACTIVE` nor `RESERVED`, or whose dealership ' +
        'is not `ACTIVE`, is `404 VEHICLE_NOT_FOUND`** — the same answer as a slug that never ' +
        'existed, so the response says nothing about a car in review, rejected, sold or ' +
        'withdrawn. The registration ' +
        'appears only as its RTO; no id, moderation field, storage key or phone number is ' +
        'returned (a dealer\u2019s number is only ever revealed by the rate-limited reveal ' +
        'route, which is not built).',
      audience: 'public',
      params: 'VehicleSlugParam',
      responses: [
        {
          status: 200,
          description: 'The vehicle.',
          schema: 'PublicVehicleDetail',
          example: {
            slug: CARD_EXAMPLE.slug,
            title: CARD_EXAMPLE.title,
            year: 2023,
            priceLabel: '₹14,50,000',
            negotiabilityLabel: 'Fixed price',
            summary: 'Petrol · Automatic · 22,400 km',
            description: 'Single owner, full service history.',
            specs: [
              { label: 'Make', value: 'Hyundai' },
              { label: 'Registered at', value: 'TN 23' },
            ],
            images: [
              {
                url: 'http://localhost:4000/media/by-media/bc7de20d-30a4-41ed-a364-8f34771a20a8/1024.webp',
                alt: '2023 Hyundai Creta SX(O), photograph 1 of 8',
              },
            ],
            primaryIndex: 0,
            publishedLabel: 'Listed 26 Sep 2026',
            dealer: { ...CARD_EXAMPLE.dealer, location: 'Katpadi, Vellore' },
          },
        },
      ],
      errors: [400, 404, 429],
    },
    {
      method: 'get',
      path: '/v1/dealers/:slug/vehicles',
      operationId: 'listPublicDealerVehicles',
      tag: DOC_TAGS.vehiclesPublic,
      summary: 'One dealership\u2019s cars on the marketplace',
      description:
        'The inventory on a dealer\u2019s portfolio page (**R48**): the same cards, the same ' +
        'public rule and the same newest-first order as `GET /v1/vehicles`, limited to one ' +
        'dealership. `page.total` is every live car it has, and is the number the directory ' +
        'card and the portfolio\u2019s "Cars available" show — all three read one predicate.\n\n' +
        'A slug that is not a listed (ACTIVE) dealership is `404 DEALER_NOT_FOUND`; a listed ' +
        'dealership with nothing live is an empty page, not an error.\n\n' +
        '**The same search as `GET /v1/vehicles`** (**F086**), fixed to one dealership: every ' +
        'filter, sort and facet is available except `district`, `city` and `dealer`, which the ' +
        'dealership already decides (a 400 if sent). `cities` and `dealers` are always empty, ' +
        'so no count can reveal another dealership.\n\n' +
        SEARCH_DESCRIPTION,
      audience: 'public',
      params: 'SlugParam',
      query: 'DealerVehicleQuery',
      responses: [
        {
          status: 200,
          description: 'A page of the dealership\u2019s vehicle cards.',
          schema: 'PublicVehiclesResponse',
          example: {
            data: [CARD_EXAMPLE],
            page: { page: 1, limit: 24, total: 1, totalPages: 1 },
            facets: FACETS_EXAMPLE,
          },
        },
      ],
      errors: [400, 404, 429],
    },
    {
      method: 'get',
      path: '/v1/search/vehicles',
      operationId: 'suggestVehicles',
      tag: DOC_TAGS.vehiclesPublic,
      summary: 'Car suggestions, while the buyer is still typing',
      description:
        'The typeahead behind the marketplace\u2019s search box (**R54**), the counterpart of ' +
        '`GET /v1/search/dealers`: called after the first character on a 300 ms debounce, ' +
        'six rows by default and never more than ten.\n\n' +
        'A row is a **brand**, a **model** or a **variant** found in the public cars in ' +
        'scope, never a car: no price, no photograph and no dealership. Each carries the ' +
        'parameters choosing it writes \u2014 `brand` and `model` are the same slugs the ' +
        'marketplace\u2019s filters take, and a variant, which has no filter of its own, is ' +
        'its model plus `variant` as `q`.\n\n' +
        'Every word of `search` must appear in the row\u2019s label. Ranking is label-prefix, ' +
        'then word-prefix, then anywhere; ties go brand, model, variant, then most cars, ' +
        'then alphabetically, so two identical requests cannot answer in two orders. Spellings ' +
        'that slug alike are one row, labelled with the commonest.\n\n' +
        '`district`, `city` and `dealer` narrow it exactly as they narrow `GET /v1/vehicles`; ' +
        'the other filters do not, because a suggestion replaces the brand and model a buyer ' +
        'has chosen. `search` is echoed for the client\u2019s stale-answer check, and ' +
        '`countLabel` counts everything that matched, not the rows returned.\n\n' +
        'Cached publicly for a minute and rate-limited per IP like every public read.',
      audience: 'public',
      query: 'CarSuggestQuery',
      rateLimit: '120 requests per minute per IP, shared with the other public reads.',
      responses: [
        {
          status: 200,
          description: 'The suggestions, best match first, and the count they were cut from.',
          schema: 'CarSuggestResponse',
          example: {
            search: 'cre',
            data: [
              {
                kind: 'MODEL',
                label: 'Hyundai Creta',
                metaLabel: 'Model \u00b7 5 cars',
                brand: 'hyundai',
                model: 'creta',
                variant: null,
                count: 5,
              },
              {
                kind: 'VARIANT',
                label: 'Hyundai Creta SX(O)',
                metaLabel: 'Variant \u00b7 2 cars',
                brand: 'hyundai',
                model: 'creta',
                variant: 'SX(O)',
                count: 2,
              },
            ],
            countLabel: '2 matches',
          },
        },
      ],
      errors: [400, 429],
    },
  ],
};
