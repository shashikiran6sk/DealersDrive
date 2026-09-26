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
  ],
};
