import type { ModuleDocs } from '../../docs/spec.js';

/**
 * A1–A11. The buyer-facing catalogue.
 *
 * Every read here answers the same question the same way: a car is visible only
 * when `listing.status = APPROVED` **and** `dealer.status = ACTIVE`, evaluated
 * once in the `listing_search` read model. Nothing in this group can return a
 * car that fails that test, and no count in it is stored — they are all derived
 * from the same rows the results come from.
 */
export const searchDocs: ModuleDocs = {
  tag: 'Public catalogue',
  description:
    'Search, vehicle detail and dealer profiles, for anonymous buyers. No session, no ' +
    'account, and **no dealer phone number** — `POST /v1/vehicles/{id}/reveal-contact` is ' +
    'the only endpoint that returns one. IP rate-limited at 120 requests/minute.',
  operations: [
    {
      method: 'get',
      path: '/v1/home',
      operationId: 'getHome',
      tag: 'Public catalogue',
      summary: 'Homepage payload for one city',
      description:
        'Featured cars, body-type tiles with counts, a dealer strip and the live count for ' +
        'the chosen city. Omit `city` and the platform default is used — the same slug ' +
        '`GET /v1/cities` returns as `default`.\n\n' +
        '`activeCount` is scoped to the city in the response, not to the whole state.',
      audience: 'public',
      query: 'HomeQuery',
      rateLimit: '120 requests per minute per IP',
      responses: [{ status: 200, description: 'Homepage payload.', schema: 'HomeResponse' }],
      errors: [429],
    },
    {
      method: 'get',
      path: '/v1/vehicles',
      operationId: 'searchVehicles',
      tag: 'Public catalogue',
      summary: 'Search and filter the catalogue',
      description:
        'The main search endpoint. Offset-paginated, because SEO needs linkable pages.\n\n' +
        '**The query grammar is `.strict()`** — an unrecognised parameter is a 400 naming ' +
        'the parameter, never a silent ignore, so a broken filter surfaces immediately ' +
        'instead of quietly returning everything.\n\n' +
        'Multi-value filters take a comma-separated list of lowercase slugs: ' +
        '`?fuel=petrol,diesel&make=maruti-suzuki,hyundai`. Note the case — `fuel=PETROL` ' +
        'is a 400. Prices are **paise** everywhere, including `priceMin`/`priceMax`.\n\n' +
        '`appliedFilters[]` comes back with a `removeHref` per active filter so the chip ' +
        'row does not have to rebuild query strings on the client.',
      audience: 'public',
      query: 'VehicleQuery',
      rateLimit: '120 requests per minute per IP',
      responses: [
        {
          status: 200,
          description:
            'Matching cars. An empty `data` with a populated `appliedFilters` is the ' +
            'normal no-results case, not an error.',
          schema: 'VehicleListResponse',
        },
      ],
      errors: [429],
    },
    {
      method: 'get',
      path: '/v1/vehicles/facets',
      operationId: 'getVehicleFacets',
      tag: 'Public catalogue',
      summary: 'Facet counts for the current filter set',
      description:
        'The counts beside each filter checkbox, plus the budget slider bounds, for the ' +
        'same query `GET /v1/vehicles` accepts. Options whose count is zero **are** ' +
        'returned so the panel can render them disabled — omitting them would make the ' +
        'filter list jump as a buyer types.',
      audience: 'public',
      query: 'VehicleQuery',
      rateLimit: '120 requests per minute per IP',
      responses: [{ status: 200, description: 'Facet counts.', schema: 'FacetsResponse' }],
      errors: [429],
    },
    {
      method: 'post',
      path: '/v1/vehicles/batch',
      operationId: 'getVehiclesBatch',
      tag: 'Public catalogue',
      summary: 'Hydrate saved cars by id',
      description:
        "Saved cars live in the browser's `localStorage`, so the ids arrive in a body " +
        'rather than a URL. A POST because the list can be up to 100 ids — not because it ' +
        'writes anything.\n\n' +
        'A car that has left the catalogue **must not fail the whole request**: it comes ' +
        'back in `unavailable[]` with a reason, so the saved list can show "sold" instead ' +
        'of losing every other card.',
      audience: 'public',
      requestBody: {
        schema: 'VehicleBatchInput',
        description: 'Up to 100 vehicle ids.',
        example: {
          ids: ['55714b20-2469-4280-87fb-1ac6ea79a9c5', '2f9a6f1e-0000-4000-8000-000000000000'],
        },
      },
      rateLimit: '60 requests per minute per IP',
      responses: [
        {
          status: 200,
          description: 'Cards for the ids still listed, and reasons for the ones that are not.',
          schema: 'VehicleBatchResponse',
          example: {
            data: [],
            unavailable: [{ id: '2f9a6f1e-0000-4000-8000-000000000000', reason: 'NOT_FOUND' }],
            savedCountLabel: '1 saved car',
          },
        },
      ],
      errors: [429],
    },
    {
      method: 'get',
      path: '/v1/vehicles/:idOrSlug',
      operationId: 'getVehicleDetail',
      tag: 'Public catalogue',
      summary: 'Vehicle detail page',
      description:
        'Accepts either the uuid or the SEO slug (`2021-maruti-suzuki-swift-vxi-vellore-3f2a1b`), ' +
        'so a card can link by slug and a saved-car id still resolves.\n\n' +
        "**The dealer's phone number is not in this response.** `dealer.contact[]` carries a " +
        'masked placeholder with `masked: true`; the real number comes only from ' +
        '`POST /v1/vehicles/{id}/reveal-contact`, which is rate-limited and logged.\n\n' +
        'A car that is not publicly visible — pending review, rejected, sold, or belonging to ' +
        'a suspended dealer — is a **404**, the same as one that never existed.',
      audience: 'public',
      params: 'IdOrSlugParam',
      rateLimit: '120 requests per minute per IP',
      responses: [{ status: 200, description: 'The vehicle.', schema: 'VehicleDetail' }],
      errors: [404, 429],
    },
    {
      method: 'get',
      path: '/v1/vehicles/:id/similar',
      operationId: 'getSimilarVehicles',
      tag: 'Public catalogue',
      summary: 'Similar cars',
      description:
        'Cars comparable to this one by model, price band and city. Returns `{ data }` only ' +
        '— no pagination, because the strip is a fixed length.',
      audience: 'public',
      params: 'IdParam',
      query: 'SimilarQuery',
      rateLimit: '120 requests per minute per IP',
      responses: [
        {
          status: 200,
          description: 'Up to `limit` similar cars. An empty array is normal for a rare model.',
          inlineSchema: {
            type: 'object',
            required: ['data'],
            properties: {
              data: { type: 'array', items: { $ref: '#/components/schemas/VehicleCard' } },
            },
          },
        },
      ],
      errors: [404, 429],
    },
    {
      method: 'get',
      path: '/v1/dealers',
      operationId: 'listDealers',
      tag: 'Public catalogue',
      summary: 'Dealer directory',
      description:
        'Verified dealerships with their live car counts and cheapest car. Only dealers ' +
        'whose status is ACTIVE appear, and `carCount` counts only their publicly visible ' +
        'cars — a suspended dealer disappears from this list entirely.',
      audience: 'public',
      query: 'DealerDirectoryQuery',
      rateLimit: '120 requests per minute per IP',
      responses: [
        {
          status: 200,
          description: 'Dealers, with the city filter counts.',
          schema: 'DealerDirectoryResponse',
        },
      ],
      errors: [429],
    },
    {
      method: 'get',
      path: '/v1/dealers/:slug',
      operationId: 'getPublicDealerProfile',
      tag: 'Public catalogue',
      summary: 'Public dealer profile',
      description:
        'The showroom page: address, services, stats and contact rows. As with vehicle ' +
        'detail, `contact[]` masks the phone number (`masked: true`) — this endpoint never ' +
        'returns one.',
      audience: 'public',
      params: 'SlugParam',
      rateLimit: '120 requests per minute per IP',
      responses: [{ status: 200, description: 'The dealership.', schema: 'DealerPublicProfile' }],
      errors: [404, 429],
    },
    {
      method: 'get',
      path: '/v1/dealers/:slug/vehicles',
      operationId: 'listDealerVehicles',
      tag: 'Public catalogue',
      summary: "One dealer's cars",
      description:
        "The dealer's own portfolio, filterable with the same query grammar as " +
        '`GET /v1/vehicles` (the `dealer` parameter is redundant here and simply narrows ' +
        'further).',
      audience: 'public',
      params: 'SlugParam',
      query: 'VehicleQuery',
      rateLimit: '120 requests per minute per IP',
      responses: [
        {
          status: 200,
          description: "The dealer's visible cars.",
          schema: 'DealerVehiclesResponse',
        },
      ],
      errors: [404, 429],
    },
    {
      method: 'get',
      path: '/v1/dealers/:slug/facets',
      operationId: 'getDealerFacets',
      tag: 'Public catalogue',
      summary: "Facet counts within one dealer's cars",
      description:
        'Facets scoped to this dealership. The portfolio page shows fuel, body type and ' +
        "transmission from this response — a dealer facet inside one dealer's page would " +
        'be a list of one.',
      audience: 'public',
      params: 'SlugParam',
      query: 'VehicleQuery',
      rateLimit: '120 requests per minute per IP',
      responses: [{ status: 200, description: 'Facet counts.', schema: 'FacetsResponse' }],
      errors: [404, 429],
    },
  ],
};
