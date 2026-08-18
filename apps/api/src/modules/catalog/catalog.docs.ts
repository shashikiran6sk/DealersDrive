import type { ModuleDocs } from '../../docs/spec.js';

/** A12–A14. Reference data the whole front end binds its filters to. */
export const catalogDocs: ModuleDocs = {
  tag: 'Catalogue',
  description:
    'Curated reference data: makes, models, variants, cities, colours and RTO codes. ' +
    'Dealers never free-type a make or model — they pick from this taxonomy, which is why ' +
    'search facets can be exact. All three responses are edge-cacheable and carry no ' +
    'dealer-specific or session-specific data.',
  operations: [
    {
      method: 'get',
      path: '/v1/catalog/bundle',
      operationId: 'getCatalogBundle',
      tag: 'Catalogue',
      summary: 'The whole taxonomy in one response',
      description:
        'Makes with their models and variants, cities, colours, RTO codes and the ' +
        'body/fuel/transmission vocabularies. One request rather than five, because the ' +
        'search page needs all of it before it can render a filter panel.\n\n' +
        '`Cache-Control: public, max-age=3600, stale-while-revalidate=600`.',
      audience: 'public',
      responses: [
        { status: 200, description: 'The catalogue.', schema: 'CatalogBundle' },
      ],
    },
    {
      method: 'get',
      path: '/v1/cities',
      operationId: 'listCities',
      tag: 'Catalogue',
      summary: 'Cities with live-listing counts',
      description:
        'Every city that has a presence, each with the number of cars currently visible in ' +
        'it, plus the default city the homepage opens on. The counts come from the ' +
        '`listing_search` read model, so they obey the one visibility rule and are never ' +
        'hard-coded.\n\n`Cache-Control: public, max-age=60, stale-while-revalidate=300`.',
      audience: 'public',
      responses: [
        {
          status: 200,
          description: 'Cities, newest counts first computed at request time.',
          schema: 'CitiesResponse',
          example: {
            data: [
              { slug: 'all', name: 'All of Tamil Nadu', count: 20 },
              { slug: 'vellore', name: 'Vellore', state: 'Tamil Nadu', count: 10 },
              { slug: 'katpadi', name: 'Katpadi', state: 'Tamil Nadu', count: 4 },
            ],
            default: 'vellore',
          },
        },
      ],
    },
    {
      method: 'get',
      path: '/v1/config/public',
      operationId: 'getPublicConfig',
      tag: 'Catalogue',
      summary: 'Client-safe platform configuration',
      description:
        'The subset of `platform_config` a browser is allowed to see — listing duration, ' +
        'minimum photo count, support contacts, EMI assumptions. Deliberately a *subset*: ' +
        'the admin-only keys never appear here.\n\n`Cache-Control: public, max-age=60`.',
      audience: 'public',
      responses: [{ status: 200, description: 'Public configuration.', schema: 'PublicConfig' }],
    },
  ],
};
