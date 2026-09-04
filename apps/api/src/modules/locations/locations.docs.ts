import type { ModuleDocs } from '../../docs/spec.js';

/**
 * A13. Cities, and nothing else.
 *
 * ── D1 ────────────────────────────────────────────────────────────────────
 * At the baseline this operation lived in `catalog.docs.ts`, under a
 * `Catalogue` tag that also carried makes, models, variants, colours and RTO
 * codes. Decision D1 removed that module, and the D1 entry is explicit that
 * cities are not vehicle-catalogue data: they drive the header city selector,
 * the dealer directory, search filters and dealer profiles. So the operation
 * moves here, beside the routes it documents, and the tag narrows to match.
 */
export const locationsDocs: ModuleDocs = {
  tag: 'Locations',
  description:
    'Cities with live-listing counts. Reference data the whole front end binds its city ' +
    'filters to — edge-cacheable, and carrying no dealer-specific or session-specific data.',
  operations: [
    {
      method: 'get',
      path: '/v1/cities',
      operationId: 'listCities',
      tag: 'Locations',
      summary: 'Cities with live-listing counts',
      description:
        'Every city that has a presence, each with the number of cars currently visible in ' +
        'it, plus the default city the homepage opens on. The counts come from the ' +
        '`listing_search` read model, so they obey the one visibility rule and are never ' +
        'hard-coded.\n\n' +
        '**Every count means *available*.** A sold car stays on the marketplace but is not ' +
        'stock, so it is excluded here (invariant 6).\n\n' +
        '`Cache-Control: public, max-age=60, stale-while-revalidate=300`.',
      audience: 'public',
      responses: [
        {
          status: 200,
          description: 'Cities, with counts computed at request time.',
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
  ],
};
