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

export const searchDocs: ModuleDocs = {
  tag: DOC_TAGS.vehiclesPublic,
  description:
    'The public marketplace (**F075**, **F077**, as scoped by **R45**). No session.\n\n' +
    '**Only an `ACTIVE` listing of an `ACTIVE` dealership is ever returned** — a draft, a ' +
    'listing in review, one sent back, rejected, sold or removed, and every listing of a ' +
    'suspended dealership, is absent, not greyed. A vehicle is addressed by its public ' +
    '`slug`; no internal id, registration number, moderation or audit field, storage key or ' +
    'dealer phone number appears in any response here. Search, filters and facets are ' +
    '**F076** and not built.',
  operations: [
    {
      method: 'get',
      path: '/v1/vehicles',
      operationId: 'listPublicVehicles',
      tag: DOC_TAGS.vehiclesPublic,
      summary: 'The vehicles on the marketplace',
      description:
        'Newest approval first, a page at a time (offset pagination, 1–48 per page). Each ' +
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
        '**A listing that is not `ACTIVE`, or whose dealership is not, is `404 ' +
        'VEHICLE_NOT_FOUND`** — the same answer as a slug that never existed, so the response ' +
        'says nothing about a car in review, rejected, sold or removed. The registration ' +
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
        'dealership with nothing live is an empty page, not an error.',
      audience: 'public',
      params: 'SlugParam',
      query: 'PublicVehicleQuery',
      responses: [
        {
          status: 200,
          description: 'A page of the dealership\u2019s vehicle cards.',
          schema: 'PublicVehiclesResponse',
          example: {
            data: [CARD_EXAMPLE],
            page: { page: 1, limit: 24, total: 1, totalPages: 1 },
          },
        },
      ],
      errors: [400, 404, 429],
    },
  ],
};
