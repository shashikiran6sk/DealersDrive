import { CONTRACTS_VERSION } from '@dealers-drive/contracts';

import { buildOpenApiDocument } from './openapi.js';
import type { JsonSchema } from './schemas.js';

/**
 * Converts the OpenAPI document into a Postman Collection v2.1.
 *
 * Postman can import OpenAPI directly, and for a quick look that is the right
 * move. This exists because a *generated* collection can carry three things an
 * OpenAPI import cannot:
 *
 *   1. **Semantically named path variables.** `{id}` means eight different
 *      things in this API — a vehicle, a listing, a media row, a dealership, an
 *      order, an invoice, an enquiry, a KYC document. An OpenAPI import gives
 *      you `:id` everywhere and you fill it in 34 times. Here the path decides
 *      the variable, so setting `vehicleId` once wires up nine requests.
 *   2. **Chaining.** A test script on the requests that mint ids captures them
 *      into collection variables, so "create a vehicle → submit it → approve
 *      it" runs in order without copying uuids by hand.
 *   3. **A contract assertion on every request.** One collection-level test
 *      checks that any 4xx/5xx really is an RFC 9457 problem document with a
 *      machine-readable `code` and a `traceId`. Every request you fire tests
 *      the error contract for free.
 *
 * It is generated, not maintained: `pnpm docs:postman` rewrites it, and
 * `tests/postman.test.ts` fails if the committed file has drifted.
 */

interface PostmanVariable {
  key: string;
  value: string;
  type: 'string';
  description?: string;
}

interface PostmanQueryParam {
  key: string;
  value: string;
  description?: string;
  disabled?: boolean;
}

interface PostmanHeader {
  key: string;
  value: string;
  description?: string;
  disabled?: boolean;
}

interface PostmanScript {
  listen: 'test' | 'prerequest';
  script: { type: 'text/javascript'; exec: string[] };
}

interface PostmanRequestItem {
  name: string;
  request: {
    method: string;
    header: PostmanHeader[];
    url: { raw: string; host: string[]; path: string[]; query?: PostmanQueryParam[] };
    body?: unknown;
    description: string;
  };
  response: never[];
  event?: PostmanScript[];
}

interface PostmanFolder {
  name: string;
  description: string;
  item: PostmanRequestItem[];
}

export interface PostmanCollection {
  info: { name: string; description: string; schema: string; version: string };
  variable: PostmanVariable[];
  item: PostmanFolder[];
  event: PostmanScript[];
}

/**
 * Path → variable name, first match wins.
 *
 * Order matters: `/v1/dealer/vehicles/{id}` has to beat `/v1/vehicles/{id}`, and
 * `/v1/dealers/{slug}` is a different dealership from the one the session
 * resolves to.
 */
const PATH_VARIABLES: { match: RegExp; param: string; variable: string; method?: string }[] = [
  // Deliberately *not* `vehicleId`: a DELETE wired to the variable every other
  // dealer request uses will, on a `Run all`, destroy the draft the media and
  // listing folders still need. This one is opt-in.
  { method: 'delete', match: /^\/v1\/dealer\/vehicles\/\{id\}$/, param: 'id', variable: 'disposableVehicleId' },
  { match: /^\/v1\/dealer\/vehicles\/\{id\}/, param: 'id', variable: 'vehicleId' },
  // The catalogue's dependent step. `modelId` is already captured from the
  // bundle for the create-vehicle request, so this one needs no capture of its
  // own — it reuses the model whose variants the draft will be built from.
  { match: /^\/v1\/catalog\/models\/\{id\}\/variants$/, param: 'id', variable: 'modelId' },
  { match: /^\/v1\/dealer\/listings\/\{id\}/, param: 'id', variable: 'listingId' },
  { match: /^\/v1\/dealer\/media\/\{id\}/, param: 'id', variable: 'mediaId' },
  { match: /^\/v1\/dealer\/enquiries\/\{id\}/, param: 'id', variable: 'enquiryId' },
  { match: /^\/v1\/dealer\/billing\/orders\/\{id\}/, param: 'id', variable: 'orderId' },
  { match: /^\/v1\/dealer\/billing\/invoices\/\{id\}/, param: 'id', variable: 'invoiceId' },
  { match: /^\/v1\/dealer\/documents\/\{type\}/, param: 'type', variable: 'documentType' },
  { match: /^\/v1\/admin\/dealers\/\{id\}/, param: 'id', variable: 'dealerId' },
  { match: /^\/v1\/admin\/documents\/\{id\}/, param: 'id', variable: 'documentId' },
  { match: /^\/v1\/admin\/listings\/\{id\}/, param: 'id', variable: 'listingId' },
  { match: /^\/v1\/admin\/config\/\{key\}/, param: 'key', variable: 'configKey' },
  // Public: a car anyone can see, addressed by slug on the detail page and by id
  // everywhere else.
  { match: /^\/v1\/vehicles\/\{idOrSlug\}/, param: 'idOrSlug', variable: 'vehicleSlug' },
  { match: /^\/v1\/vehicles\/\{id\}/, param: 'id', variable: 'publicVehicleId' },
  { match: /^\/v1\/dealers\/\{slug\}/, param: 'slug', variable: 'dealerSlug' },
  { match: /^\/media\/vehicles\/by-media\/\{mediaId\}/, param: 'mediaId', variable: 'mediaId' },
];

/** Literal substitutions for parameters that are not worth a variable. */
const PATH_LITERALS: Record<string, string> = { width: '640' };

/**
 * Sort weight within a folder. Everything defaults to 0 and keeps document
 * order; these go last.
 *
 * Newman runs a collection top to bottom, so a request that destroys the thing
 * the following requests need takes the rest of the folder down with it. In
 * document order `Delete a vehicle` sits between `Update` and `Submit for
 * review`, which meant a full run deleted the draft it had just built and then
 * 404'd through submit, presign and commit — the collection reporting a broken
 * API that was working perfectly.
 *
 * So the destructive operations are pushed to the end of their folder. Reading
 * order in the reference is chosen for a human learning the API; running order
 * here is chosen so that "run everything" is a meaningful smoke test.
 */
const RUN_LAST: Record<string, number> = {
  markVehicleSold: 80, // ends the listing, so renewal has nothing to renew
  // Takes the car off the marketplace entirely, so it must follow mark-sold —
  // which needs a listing that is still there — and precede the deletes.
  removeVehicleListing: 85,
  deleteVehicle: 90,
  deleteMedia: 90,
  deleteDealerDocument: 90,
};

const VARIABLES: PostmanVariable[] = [
  {
    key: 'baseUrl',
    value: 'http://localhost:4000',
    type: 'string',
    description: 'The API origin. Change this one value to point at another environment.',
  },
  {
    key: 'makeId',
    value: '',
    type: 'string',
    description:
      'A catalogue make. Captured by `The whole taxonomy in one response` — run that first, ' +
      'because a vehicle is created from ids and dealers never free-type a make.',
  },
  {
    key: 'modelId',
    value: '',
    type: 'string',
    description:
      'A model **belonging to `makeId`**. Captured alongside it; a real model filed under the ' +
      'wrong make is a 404, not a silently corrupt listing.',
  },
  {
    key: 'variantId',
    value: '',
    type: 'string',
    description:
      "A variant **belonging to `modelId`**. Captured by `One model's variants` — run that " +
      'after the bundle, because variants are no longer nested in it and a draft cannot be ' +
      'created without one.',
  },
  {
    key: 'colorId',
    value: '',
    type: 'string',
    description: 'A catalogue colour. Captured by `The whole taxonomy in one response`.',
  },
  {
    key: 'cityId',
    value: '',
    type: 'string',
    description: 'A city uuid, for the vehicle location. Captured with the rest of the catalogue.',
  },
  {
    key: 'vehicleId',
    value: '',
    type: 'string',
    description:
      'A vehicle **the acting dealer owns**. Captured by `Create a draft vehicle` and by ' +
      '`List the dealer\'s inventory`. Another dealer\'s id answers 404 by design.',
  },
  {
    key: 'disposableVehicleId',
    value: '',
    type: 'string',
    description:
      'Only `Delete a vehicle` reads this, and nothing sets it — so a `Run all` cannot destroy ' +
      'the draft the rest of the collection is using. Paste in a vehicle you actually want gone.',
  },
  {
    key: 'publicVehicleId',
    value: '',
    type: 'string',
    description: 'A publicly visible car. Captured by `Search and filter the catalogue`.',
  },
  {
    key: 'vehicleSlug',
    value: '',
    type: 'string',
    description: 'The SEO slug of a live car. Captured by `Search and filter the catalogue`.',
  },
  {
    key: 'dealerSlug',
    value: 'sri-lakshmi-motors',
    type: 'string',
    description: 'A dealership slug for the public profile endpoints.',
  },
  {
    key: 'dealerId',
    value: '',
    type: 'string',
    description: 'The acting dealership\'s uuid, for the admin endpoints. Captured by `Who am I`.',
  },
  {
    key: 'listingId',
    value: '',
    type: 'string',
    description: 'Captured by `Submit for review` and by `The moderation queue`.',
  },
  {
    key: 'mediaId',
    value: '',
    type: 'string',
    description: 'Captured by `Get a signed upload URL for a photo` and by `One vehicle`.',
  },
  { key: 'enquiryId', value: '', type: 'string', description: 'Captured by `The dealer\'s inbox`.' },
  { key: 'packId', value: '', type: 'string', description: 'Captured by `Credit packs for sale`.' },
  { key: 'orderId', value: '', type: 'string', description: 'Captured by `Buy a credit pack`.' },
  {
    key: 'invoiceId',
    value: '',
    type: 'string',
    description: 'Captured by `Confirm an order after checkout` and by `GST invoices`.',
  },
  {
    key: 'documentId',
    value: '',
    type: 'string',
    description: 'Captured by `Get an upload URL for a KYC document`.',
  },
  {
    key: 'documentType',
    value: 'GST_CERTIFICATE',
    type: 'string',
    description: 'One of GST_CERTIFICATE, PAN_CARD, ADDRESS_PROOF.',
  },
  {
    key: 'configKey',
    value: 'listing.minPhotos',
    type: 'string',
    description: 'A platform-config key. `GET /v1/admin/config` lists them all.',
  },
  {
    key: 'uploadUrl',
    value: '',
    type: 'string',
    description:
      'The signed URL from a presign response, captured so the raw `PUT /uploads` step can ' +
      'use it. Note that Postman must send the exact bytes the signature was issued for.',
  },
];

/**
 * Which responses mint an id the rest of the collection needs.
 *
 * Keyed by operationId, each entry is `[collection variable, path into the JSON
 * body]`. Only unambiguous captures are here: `searchVehicles` sets
 * `publicVehicleId` rather than `vehicleId`, because a car found in the public
 * catalogue is very probably **not** one the acting dealer owns, and quietly
 * pointing the dealer endpoints at it would produce a confusing 404.
 *
 * A `*` segment means "the first array element where the rest of the path
 * resolves". `data.*.listingId` exists because inventory is ordered newest-first
 * and the newest row is usually a draft with `listingId: null` — `data.0` would
 * capture nothing and leave `{{listingId}}` empty in the URL.
 */
const CAPTURES: Record<string, [string, string][]> = {
  // The catalogue first: a draft vehicle is created from *ids*, never free text,
  // so without these the create request would carry uuids that name nothing.
  getCatalogBundle: [
    ['makeId', 'makes.0.id'],
    ['modelId', 'makes.0.models.0.id'],
    ['colorId', 'colors.0.id'],
    ['cityId', 'cities.0.id'],
  ],
  // Variant is mandatory on create, and the bundle no longer carries variants —
  // so the create request's `variantId` comes from here, and this request has
  // to run between the bundle and the create. Both sit in document order in the
  // Catalogue and Dealer inventory folders respectively, so it already does.
  listModelVariants: [['variantId', 'data.0.id']],
  getSession: [['dealerId', 'dealer.id']],
  searchVehicles: [
    ['publicVehicleId', 'data.0.id'],
    ['vehicleSlug', 'data.0.slug'],
    ['dealerSlug', 'data.0.dealer.slug'],
  ],
  listDealers: [['dealerSlug', 'data.0.slug']],
  listInventory: [
    ['vehicleId', 'data.0.vehicleId'],
    // The renew step needs one before the Admin folder runs, and submit-for-review
    // cannot supply it: a freshly created draft has no photos, so it 422s.
    ['listingId', 'data.*.listingId'],
  ],
  createVehicle: [['vehicleId', 'id']],
  getVehicle: [['mediaId', 'media.0.mediaId']],
  submitVehicleListing: [['listingId', 'listingId']],
  getModerationQueue: [['listingId', 'data.0.listingId']],
  presignMedia: [
    ['mediaId', 'mediaId'],
    ['uploadUrl', 'uploadUrl'],
  ],
  presignDealerDocument: [
    ['documentId', 'documentId'],
    ['uploadUrl', 'uploadUrl'],
  ],
  listCreditPacks: [['packId', 'data.0.id']],
  createCreditOrder: [['orderId', 'orderId']],
  verifyCreditOrder: [['invoiceId', 'invoice.id']],
  listInvoices: [['invoiceId', 'data.0.id']],
  listDealerEnquiries: [['enquiryId', 'data.0.id']],
};

/**
 * Runs after every request in the collection.
 *
 * Every failure this API can produce is an RFC 9457 problem document — there is
 * no second error shape — so the contract can be asserted once here instead of
 * per request. Fire any request in this collection and the error contract is
 * tested for free.
 */
const COLLECTION_TESTS = [
  "const status = pm.response.code;",
  '',
  'if (status >= 400) {',
  '  pm.test(`${status} is application/problem+json`, () => {',
  "    pm.expect(pm.response.headers.get('content-type') || '').to.include(",
  "      'application/problem+json',",
  '    );',
  '  });',
  '',
  '  pm.test(`${status} carries a machine-readable code and a traceId`, () => {',
  '    const problem = pm.response.json();',
  "    pm.expect(problem).to.have.property('code');",
  "    pm.expect(problem).to.have.property('traceId');",
  "    pm.expect(problem.status, 'body.status should match the HTTP status').to.eql(status);",
  '    // `detail` is for humans; clients switch on `code`.',
  "    pm.expect(problem, 'a problem body must never carry a stack trace').to.not.have.property(",
  "      'stack',",
  '    );',
  '  });',
  '}',
  '',
  'pm.test(`${status} is not a server error`, () => {',
  '  pm.expect(status, pm.response.text().slice(0, 300)).to.be.below(500);',
  '});',
];

/**
 * The requests that do **not** return 2xx on a freshly seeded database, and why.
 *
 * Thirteen of the seventy-three, and every one is the API behaving correctly.
 * Without this note a tester reasonably reads a 409 as a broken collection and
 * starts debugging the wrong thing; the alternative — trimming the collection to
 * the requests that go green — would hide a third of the state machine.
 */
const CLEAN_RUN_NOTES: Record<string, string> = {
  submitDealerForVerification:
    '**422 on a clean seed.** The development dealer is already verified, and its KYC set is ' +
    'incomplete either way. `GET /v1/dealer/completeness` lists what is missing.',
  commitDealerDocument:
    '**422 `UPLOAD_MISSING` on a clean seed.** Presign issues a signed URL, but a collection ' +
    'cannot ship the file that has to be PUT to it, so there is nothing to confirm.',
  submitVehicleListing:
    '**422 `TOO_FEW_PHOTOS` on a clean seed**, for the same reason: the draft this collection ' +
    'creates has no photos. Upload three through the dealer console and this returns 201 with ' +
    'one credit held.',
  renewListing:
    '**409 on a clean seed** — nothing has expired yet. Listings run 30 days from approval.',
  markVehicleSold:
    '**409 on a clean seed.** Only a published car can be marked sold, and the draft this ' +
    'collection creates never got published.',
  deleteVehicle:
    '**Deliberately unwired.** `{{disposableVehicleId}}` is empty, so this 404s rather than ' +
    'destroying the draft the Media and Billing folders still need. Paste an id in when you ' +
    'mean it.',
  commitMedia:
    '**422 `UPLOAD_MISSING` on a clean seed** — see *Get a signed upload URL for a photo*. ' +
    'Nothing was PUT to the signed URL.',
  reorderVehicleMedia:
    '**404 on a clean seed.** `{{mediaId}}` is a presigned record that was never committed, so ' +
    'it is not attached to the vehicle whose order you are setting.',
  getInvoicePdf:
    '**404 `PDF_NOT_READY` on a clean seed.** Rendering is queued on purchase; the code is the ' +
    'signal to poll rather than to retry the purchase.',
  approveDealer:
    '**422 on a clean seed** — this dealership is already approved. Suspend and reinstate it ' +
    'instead to watch its cars leave and re-enter the catalogue.',
  rejectListing:
    '**409 on a clean seed.** *Approve a listing* ran a moment earlier, and an approved listing ' +
    'cannot be rejected — use *Take a listing down*.',
  requestListingChanges:
    '**409 on a clean seed**, same reason as *Reject a listing*. On a listing that is still in ' +
    'review this returns 200 and the held credit **stays held** — that is what separates it ' +
    'from a rejection.',
  putUpload:
    '**400 by design.** This documents the storage route the presign points at; the query ' +
    'string carries a signature this request has no way to produce. Use `{{uploadUrl}}` from a ' +
    'presign response.',
  getMediaDerivative:
    '**404 on a clean seed** — no image was uploaded, so nothing was processed into a rendition.',
};

function cleanRunNote(operationId: string): string | undefined {
  return CLEAN_RUN_NOTES[operationId];
}

function captureScript(operationId: string): PostmanScript | null {
  const captures = CAPTURES[operationId];
  if (!captures) return null;

  const exec = [
    '// Captures ids the rest of the collection needs, so a flow can be run in',
    '// order without copying uuids by hand.',
    'if (pm.response.code < 400) {',
    '  const body = pm.response.json();',
    '',
    "  // A `*` segment takes the first array element whose remaining path resolves.",
    "  const read = (path) => {",
    "    const keys = path.split('.');",
    '    const walk = (node, index) => {',
    '      if (node == null) return undefined;',
    '      if (index === keys.length) return node;',
    "      if (keys[index] !== '*') return walk(node[keys[index]], index + 1);",
    '      if (!Array.isArray(node)) return undefined;',
    '      for (const entry of node) {',
    '        const found = walk(entry, index + 1);',
    '        if (found != null) return found;',
    '      }',
    '      return undefined;',
    '    };',
    '    return walk(body, 0);',
    '  };',
    '',
  ];

  for (const [variable, path] of captures) {
    exec.push(
      `  const ${variable} = read('${path}');`,
      `  if (${variable}) pm.collectionVariables.set('${variable}', ${variable});`,
    );
  }

  exec.push('}');
  return { listen: 'test', script: { type: 'text/javascript', exec } };
}

/**
 * Body fields that hold an id, and the collection variable that supplies it.
 *
 * The OpenAPI examples carry literal uuids, which is right for a reference — a
 * reader needs to see the shape of a real value. It is wrong for a runnable
 * collection: those uuids name nothing, and `POST /v1/dealer/vehicles` with a
 * make that does not exist is a 404 (it used to be a 500 — newman found that
 * while this generator was being written). Substituting by *field name* keeps
 * the two artifacts honest without duplicating either.
 */
const BODY_VARIABLES: Record<string, string> = {
  makeId: 'makeId',
  modelId: 'modelId',
  variantId: 'variantId',
  colorId: 'colorId',
  cityId: 'cityId',
  packId: 'packId',
  documentId: 'documentId',
  // The presign example attaches a photo to a vehicle, so its owner is one the
  // acting dealer owns — not the public car the enquiry example asks about.
  ownerId: 'vehicleId',
  vehicleId: 'publicVehicleId',
};

/** Array fields whose every element is an id. */
const BODY_ARRAY_VARIABLES: Record<string, string> = {
  ids: 'publicVehicleId',
  mediaIds: 'mediaId',
};

function withVariables(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(withVariables);
  if (typeof value !== 'object' || value === null) return value;

  const out: Record<string, unknown> = {};

  for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
    const scalar = BODY_VARIABLES[key];
    const array = BODY_ARRAY_VARIABLES[key];

    if (scalar && typeof nested === 'string') out[key] = `{{${scalar}}}`;
    else if (array && Array.isArray(nested)) out[key] = [`{{${array}}}`];
    else out[key] = withVariables(nested);
  }

  return out;
}

/**
 * A JSON Schema value as display text, or `undefined` when there is nothing a
 * reader could sensibly be shown. `JsonSchema` is `Record<string, unknown>`, so
 * every field arrives untyped — an object here would stringify to
 * `[object Object]` in a description Postman shows to a tester.
 */
function scalarText(value: unknown): string | undefined {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return undefined;
}

/** A one-line hint about a query parameter, built from its schema. */
function constraintHint(schema: JsonSchema): string {
  const parts: string[] = [];

  const type = schema.type;
  const enumValues = schema.enum;

  if (Array.isArray(enumValues)) parts.push(`one of: ${enumValues.join(', ')}`);
  else if (typeof type === 'string') parts.push(type);

  if (typeof schema.pattern === 'string') parts.push(`matching \`${schema.pattern}\``);
  if (typeof schema.minimum === 'number' || typeof schema.maximum === 'number') {
    const minimum = typeof schema.minimum === 'number' ? schema.minimum : '−∞';
    const maximum = typeof schema.maximum === 'number' ? schema.maximum : '∞';
    parts.push(`${minimum}…${maximum}`);
  }
  if (typeof schema.maxLength === 'number') parts.push(`max ${schema.maxLength} chars`);

  const fallback = scalarText(schema.default);
  if (fallback !== undefined) parts.push(`default \`${fallback}\``);

  return parts.join(' · ');
}

interface OpenApiParameter {
  name: string;
  in: string;
  required: boolean;
  description?: string;
  schema: JsonSchema;
}

interface OpenApiOperation {
  operationId: string;
  tags: string[];
  summary: string;
  description: string;
  parameters: OpenApiParameter[];
  requestBody?: {
    required: boolean;
    description?: string;
    content: Record<string, { schema?: unknown; example?: unknown }>;
  };
}

interface OpenApiDocument {
  info: { description: string };
  tags: { name: string; description: string }[];
  paths: Record<string, Record<string, OpenApiOperation>>;
}

/** `/v1/dealer/vehicles/{id}` → `/v1/dealer/vehicles/{{vehicleId}}`. */
function substitutePath(path: string, method: string): string {
  return path.replace(/\{([^}]+)\}/g, (_match, param: string) => {
    const literal = PATH_LITERALS[param];
    if (literal) return literal;

    const rule = PATH_VARIABLES.find(
      (candidate) =>
        candidate.param === param &&
        candidate.match.test(path) &&
        (candidate.method === undefined || candidate.method === method),
    );
    if (!rule) {
      throw new Error(`postman: no variable mapped for {${param}} in ${path}`);
    }
    return `{{${rule.variable}}}`;
  });
}

function buildRequest(path: string, method: string, operation: OpenApiOperation): PostmanRequestItem {
  const substituted = substitutePath(path, method);

  const query: PostmanQueryParam[] = operation.parameters
    .filter((parameter) => parameter.in === 'query')
    .map((parameter) => {
      const hint = constraintHint(parameter.schema);
      const description = [parameter.description, hint].filter(Boolean).join(' — ');
      return {
        key: parameter.name,
        value: scalarText(parameter.schema.default) ?? '',
        ...(description ? { description } : {}),
        // Enabled only when the API requires it. Postman sends every enabled
        // param, and this API is `.strict()` — an empty `?q=` is a real filter
        // for an empty string, not the absence of one.
        disabled: !parameter.required,
      };
    });

  const headers: PostmanHeader[] = [{ key: 'Accept', value: 'application/json' }];

  const traceHeader = operation.parameters.find((parameter) => parameter.in === 'header');
  if (traceHeader) {
    headers.push({
      key: traceHeader.name,
      value: '',
      ...(traceHeader.description ? { description: traceHeader.description } : {}),
      disabled: true,
    });
  }

  const json = operation.requestBody?.content['application/json'];
  const binary = operation.requestBody?.content['application/octet-stream'];

  let body: unknown;
  if (json) {
    headers.push({ key: 'Content-Type', value: 'application/json' });
    body = {
      mode: 'raw',
      raw: JSON.stringify(withVariables(json.example ?? {}), null, 2),
      options: { raw: { language: 'json' } },
    };
  } else if (binary) {
    body = { mode: 'file', file: { src: '' } };
  }

  const queryString = query
    .filter((parameter) => !parameter.disabled)
    .map((parameter) => `${parameter.key}=${parameter.value}`)
    .join('&');

  const item: PostmanRequestItem = {
    name: operation.summary,
    request: {
      method: method.toUpperCase(),
      header: headers,
      url: {
        raw: `{{baseUrl}}${substituted}${queryString ? `?${queryString}` : ''}`,
        host: ['{{baseUrl}}'],
        path: substituted.replace(/^\//, '').split('/'),
        ...(query.length > 0 ? { query } : {}),
      },
      ...(body ? { body } : {}),
      description: cleanRunNote(operation.operationId)
        ? `${operation.description}\n\n---\n\n${cleanRunNote(operation.operationId) ?? ''}`
        : operation.description,
    },
    response: [],
  };

  const capture = captureScript(operation.operationId);
  if (capture) item.event = [capture];

  return item;
}

const HOW_TO_USE = `
## How to use this collection

1. Start the stack — \`docker compose up -d\`, then \`pnpm db:migrate && pnpm db:seed\` in
\`apps/api\`, then \`pnpm dev\`.
2. Check \`baseUrl\` points at your API (default \`http://localhost:4000\`).
3. **There is nothing to authorize.** Identity is resolved server-side from
\`DEV_DEALER_SLUG\` / \`DEV_ADMIN_EMAIL\`, so the dealer and admin folders work with no token,
no cookie and no header. Send *Who am I* first to see which dealership you are acting as.
To act as a different dealership, restart the API with a different \`DEV_DEALER_SLUG\` —
there is no header that could do it.

### Variables chain themselves

Requests that mint an id capture it into a collection variable, so a flow runs in order
without copying uuids. A good first pass:

| # | Request | Sets |
| --- | --- | --- |
| 1 | *Who am I* | \`dealerId\` |
| 2 | *Search and filter the catalogue* | \`publicVehicleId\`, \`vehicleSlug\`, \`dealerSlug\` |
| 3 | *Create a draft vehicle* | \`vehicleId\` |
| 4 | *Update a vehicle* | — fills in price, km, description |
| 5 | *Get a signed upload URL for a photo* | \`mediaId\`, \`uploadUrl\` |
| 6 | *Submit for review* | \`listingId\` — and holds one credit |
| 7 | *Approve a listing* (Admin) | spends the held credit |
| 8 | *Credit history* | shows \`HOLD_SUBMIT\` then \`CONSUME_APPROVE\` |

Step 6 will refuse with 422 until the vehicle is complete and has six processed photos —
that is the real rule, not a quirk of the collection. \`GET /v1/dealer/vehicles/{{vehicleId}}\`
reports exactly what is missing in \`completeness.blockers\`.

### Every request tests the error contract

A collection-level script asserts that any 4xx or 5xx is a genuine RFC 9457 problem
document with a machine-readable \`code\`, a \`traceId\`, a matching \`status\`, and no stack
trace. You get that for free on every request, so deliberately breaking one is a useful
test rather than a dead end.

### Things worth trying deliberately

- Send \`?colour=red\` to *Search* — every input schema is \`.strict()\`, so an unknown
  parameter is a 400 that **names** the parameter.
- Put \`"status": "APPROVED"\` in *Update a vehicle* — also a 400. A listing's status changes
  only through the state machine.
- Approve the same listing twice — the second is 409 \`INVALID_TRANSITION\`, not a double
  approval.
- Set \`vehicleId\` to a uuid belonging to another dealership — **404, not 403**. A 403 would
  confirm the id is real.

### Query parameters are disabled by default

Optional parameters are present but switched off, because this API is \`.strict()\` and an
empty \`?q=\` is a filter for the empty string rather than the absence of a filter. Tick the
ones you want.

---

Generated from the OpenAPI document by \`pnpm docs:postman\`. Do not edit by hand — the
same document is served live at \`/api/docs\`, and a test fails if this file drifts from it.
`.trim();

export function buildPostmanCollection(): PostmanCollection {
  // A fixed base URL rather than `env.API_BASE_URL`: a collection is a portable
  // artifact, and baking one developer's environment into a committed file is
  // how it stops being portable.
  const document = buildOpenApiDocument({ serverUrl: 'http://localhost:4000' }) as unknown as OpenApiDocument;

  const folders = new Map<string, PostmanFolder>();

  for (const tag of document.tags) {
    // The auth section is prose, not endpoints; its content is in the
    // collection description instead.
    if (tag.name === 'Authentication & authorization') continue;
    folders.set(tag.name, { name: tag.name, description: tag.description, item: [] });
  }

  const weights = new WeakMap<PostmanRequestItem, number>();
  const seen = new Set<string>();

  for (const [path, methods] of Object.entries(document.paths)) {
    for (const [method, operation] of Object.entries(methods)) {
      seen.add(operation.operationId);
      const folder = folders.get(operation.tags[0] ?? '');
      if (!folder) throw new Error(`postman: no folder for tag "${operation.tags[0] ?? ''}"`);

      const request = buildRequest(path, method, operation);
      weights.set(request, RUN_LAST[operation.operationId] ?? 0);
      folder.item.push(request);
    }
  }

  // A note keyed by an operationId that no longer exists would silently vanish,
  // and these three tables are the collection's only hand-written parts.
  for (const table of [CLEAN_RUN_NOTES, RUN_LAST, CAPTURES]) {
    for (const operationId of Object.keys(table)) {
      if (!seen.has(operationId)) {
        throw new Error(`postman: no operation "${operationId}" — a hand-written table is stale`);
      }
    }
  }

  // Stable: only the weighted few move, everything else keeps document order.
  for (const folder of folders.values()) {
    folder.item.sort((a, b) => (weights.get(a) ?? 0) - (weights.get(b) ?? 0));
  }

  return {
    info: {
      name: 'Dealers-Drive API',
      description: `${document.info.description}\n\n---\n\n${HOW_TO_USE}`,
      schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
      version: CONTRACTS_VERSION,
    },
    variable: VARIABLES,
    item: [...folders.values()],
    event: [{ listen: 'test', script: { type: 'text/javascript', exec: COLLECTION_TESTS } }],
  };
}

/** A matching environment, so `baseUrl` can be switched without editing the collection. */
export function buildPostmanEnvironment(): Record<string, unknown> {
  return {
    name: 'Dealers-Drive — local',
    values: VARIABLES.map((variable) => ({
      key: variable.key,
      value: variable.value,
      type: 'default',
      enabled: true,
    })),
    _postman_variable_scope: 'environment',
  };
}
