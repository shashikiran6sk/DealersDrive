import type { ModuleDocs } from '../../docs/spec.js';

/**
 * A8–A9. The dealer directory, and one dealership's public page.
 *
 * A separate module from `dealers.docs.ts` because it is a separate *audience*.
 * The tag a reader browses is "who is this for", not "which file is it in", and
 * these two operations answer to nobody: no session, no principal, no dealer's
 * own record. Folding them into `Dealer account` would put an unauthenticated
 * directory under a heading whose whole description is about the acting
 * dealership.
 *
 * ── Reconstruction slice ────────────────────────────────────────────────────
 * The baseline documented these under the search module's tag, because that is
 * where the routes were mounted. The search module arrives at **F076**, and its
 * operations are the vehicle ones; these two stay here, beside the service that
 * answers them.
 * ────────────────────────────────────────────────────────────────────────────
 */
export const dealersPublicDocs: ModuleDocs = {
  tag: 'Dealers (public)',
  description:
    'The buyer-facing view of a dealership. **No response under this tag contains a phone ' +
    'number or an email address**, and that is a property of the schemas rather than of the ' +
    'handlers: `DealerPublicProfile.contact` carries a row marked `masked` reading "Tap to ' +
    'reveal", and there is no field in it that could hold a number. ' +
    '`POST /v1/vehicles/:id/reveal-contact` is the only route that returns one, and it is a ' +
    'POST precisely so it can be rate-limited twice over and logged as a lead (rule 7).',
  operations: [
    {
      method: 'get',
      path: '/v1/dealers',
      operationId: 'getDealerDirectory',
      tag: 'Dealers (public)',
      summary: 'The dealer directory',
      description:
        'Every ACTIVE dealership, filtered by city slug and by a substring of the trading ' +
        'name, paged. `cities` carries the chips — only localities that actually hold a ' +
        'verified dealership, counted over the whole directory rather than over the page, so ' +
        'choosing a chip cannot empty the row it was chosen from.\n\n' +
        'A dealership with no live cars still appears, with `fromPriceLabel` as an em dash. ' +
        'It is a verified business that has not listed yet, not an error.\n\n' +
        '`Cache-Control: public, max-age=300`.',
      audience: 'public',
      query: 'DealerDirectoryQuery',
      rateLimit: '120 requests per minute per IP, shared with the other public reads.',
      responses: [
        {
          status: 200,
          description: 'The directory page, its count label and its city chips.',
          schema: 'DealerDirectoryResponse',
        },
      ],
    },
    {
      method: 'get',
      path: '/v1/dealers/:slug',
      operationId: 'getDealerPublicProfile',
      tag: 'Dealers (public)',
      summary: "One dealership's public page",
      description:
        'The portfolio header: who the dealership is, what it does, where the yard is and ' +
        'how quickly it answers. `address.mapsUrl` is the link the dealer pasted themselves ' +
        'and is null on dealerships that predate the question — the page renders no ' +
        '"Get directions" rather than composing one from the address, because a typed ' +
        'address is several pins in one district.\n\n' +
        '**404 on anything but an ACTIVE dealership.** A suspended or pending dealership is ' +
        'not "temporarily unavailable" to a buyer; it is not listed.\n\n' +
        '`Cache-Control: public, max-age=300`.',
      audience: 'public',
      params: 'SlugParam',
      rateLimit: '120 requests per minute per IP, shared with the other public reads.',
      responses: [
        {
          status: 200,
          description: 'The dealership.',
          schema: 'DealerPublicProfile',
        },
      ],
      errors: [404],
    },
  ],
};
