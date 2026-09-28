import type { ModuleDocs } from '../../docs/spec.js';
import { DOC_TAGS } from '../../docs/tags.js';

export const savedVehiclesDocs: ModuleDocs = {
  tag: DOC_TAGS.savedVehicles,
  description:
    'A signed-in customer’s saved cars (**R74**, revising F087’s device-only list). The ' +
    'shortlist lives on the server, so it follows the account to any device.\n\n' +
    '**Whose list.** The customer is the session — a customer or a dealer’s own session, ' +
    'which is also a customer (R62). No path, query or body names a customer, so one ' +
    'customer can never read or change another’s list. Cars are addressed by their public ' +
    'slug, the only identifier a buyer is ever given.\n\n' +
    '**Lifecycle.** A saved row is never deleted when the car is reserved, sold or withdrawn; ' +
    'the card’s `availability` says what became of it (`AVAILABLE`, `RESERVED`, `SOLD` or ' +
    '`UNAVAILABLE`). A car that has left the marketplace carries no photograph.\n\n' +
    'Every response here is `Cache-Control: no-store`.',
  operations: [
    {
      method: 'get',
      path: '/v1/saved-vehicles',
      operationId: 'listSavedVehicles',
      tag: DOC_TAGS.savedVehicles,
      summary: 'Your saved cars',
      description:
        'The customer’s saved cars, most recently saved first, cursor-paginated. Each entry is ' +
        '`savedAt` and the same `VehicleCardDto` the marketplace uses, with `availability` ' +
        'telling the page whether the car can still be opened.',
      audience: 'customer',
      query: 'SavedVehiclesQuery',
      responses: [
        { status: 200, description: 'A page of saved cars.', schema: 'SavedVehiclesResponse' },
      ],
      errors: [400, 401, 409],
    },
    {
      method: 'get',
      path: '/v1/saved-vehicles/slugs',
      operationId: 'listSavedVehicleSlugs',
      tag: DOC_TAGS.savedVehicles,
      summary: 'Which cars you have saved',
      description:
        'Every slug the customer has saved (at most 500), so a page of cards can draw each ' +
        'heart from one request instead of one per card.',
      audience: 'customer',
      responses: [{ status: 200, description: 'The saved slugs.', schema: 'SavedVehicleSlugs' }],
      errors: [401],
    },
    {
      method: 'put',
      path: '/v1/saved-vehicles/:slug',
      operationId: 'saveVehicle',
      tag: DOC_TAGS.savedVehicles,
      summary: 'Save a car',
      description:
        'Idempotent: saving a car twice leaves one saved row, and the second answer is the same ' +
        '`{ slug, saved: true }`. The pair is unique in the database, so two taps at once land ' +
        'one row.\n\n' +
        '**Only a car on the marketplace can be newly saved** — `ACTIVE` or `RESERVED`, of an ' +
        '`ACTIVE` dealership. Anything else is `409 LISTING_NOT_SAVEABLE`; the listing row is ' +
        'read `FOR SHARE`, so a withdrawal racing a save either lands first and refuses it, or ' +
        'waits for it. A car already saved stays saved whatever happens to it later. A slug ' +
        'that never existed is `404 LISTING_NOT_FOUND`. Rate-limited per customer.',
      audience: 'customer',
      params: 'VehicleSlugParam',
      responses: [{ status: 200, description: 'Saved.', schema: 'SavedState' }],
      errors: [400, 401, 404, 409, 429],
    },
    {
      method: 'delete',
      path: '/v1/saved-vehicles/:slug',
      operationId: 'unsaveVehicle',
      tag: DOC_TAGS.savedVehicles,
      summary: 'Remove a saved car',
      description:
        'Idempotent: removing a car that is not saved answers `{ slug, saved: false }` all the ' +
        'same. Works whatever the car’s state, so a sold or withdrawn car can be cleared from ' +
        'the list. A slug that never existed is `404 LISTING_NOT_FOUND`. Rate-limited per ' +
        'customer.',
      audience: 'customer',
      params: 'VehicleSlugParam',
      responses: [{ status: 200, description: 'Not saved.', schema: 'SavedState' }],
      errors: [400, 401, 404, 429],
    },
  ],
};
