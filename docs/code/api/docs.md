# api / docs

Parent: [api](../README.md)

The notes below belonged to the files named under each heading. Each heading is the
declaration the note sat above.

## `apps/api/src/docs/docs.routes.ts`

### `export function createDocsRouter(): Router`

Swagger UI and the raw document.

GET /api/docs the UI
GET /api/docs/openapi.json the document
GET /api/docs/openapi.yaml the same document, as YAML

Mounted outside `/v1`, like `/health`: the reference is not itself versioned
API surface, and a client should not have to bump a version prefix to read the
docs for the version it is already on.

The document is built **once** at startup rather than per request. It is
derived entirely from code — the contracts schemas and the per-module
operation lists — so nothing about it can change while the process runs, and
converting ~140 Zod schemas on every page load would be waste.

### `router.use`

Swagger UI needs a looser policy than the JSON API.

The app-wide `helmet()` sets `script-src 'self'`, and swagger-ui-express
bootstraps itself with an inline `<script>`. Rather than weaken the policy
for the whole API, this replaces it on this route only — the JSON endpoints
keep the strict default. Everything is still same-origin: the UI's assets
are served by this process, not from a CDN.

### `customCss: ``

Swagger UI renders markdown tables without borders, which turns the
permission matrix and the credit-lifecycle table into loosely aligned
columns. Three rules, no theming: the tables are load-bearing
documentation, not decoration.

### `docExpansion: 'none'`

Collapsed: 73 operations expanded is a wall, and the tag descriptions

### `docExpansion: 'none'`

are where the conventions are explained.

### `operationsSorter: 'alpha'`

Alphabetical within a tag, so an endpoint is findable without reading

### `operationsSorter: 'alpha'`

the whole group.

### `deepLinking: true`

So a link to one endpoint is a link to one endpoint — a code review

### `deepLinking: true`

that says "see POST /listings/{id}/approve" can point at it.

### `defaultModelRendering: 'model'`

The schema tab is more useful than the generated example for reading

### `defaultModelRendering: 'model'`

a contract; the example is one click away either way.

## `apps/api/src/docs/errors.ts`

### `const PROBLEM_REF: JsonSchema = { $ref: '#/components/schemas/ProblemDetails' }`

The error half of the contract, written once.

Every failure this API can produce is an RFC 9457 problem document with
`application/problem+json` — there is no second error shape (§23), so there is
no reason for 73 operations to describe one each. These become
`components.responses`, and each operation lists the statuses it can actually
return.

The status → code mapping is not invented here; it is what the error classes
in `platform/errors.ts` declare:

ZodError → 400 VALIDATION_FAILED (with `errors[]` per field)
body-parser → 400 MALFORMED_BODY / 413 / 415
UnauthorizedError → 401 NOT_AUTHENTICATED
ForbiddenError → 403 FORBIDDEN | DEALER_NOT_ACTIVE
NotFoundError → 404 NOT_FOUND
ConflictError → 409 <code>
DomainError → 422 <code>
RateLimitError → 429 RATE_LIMITED (+ Retry-After)
anything else → 500 INTERNAL

### `export const ERROR_RESPONSES: Record<string, ProblemResponse> =`

Keyed by the name an operation references: `$ref: '#/components/responses/…'`.

### `export const ERROR_RESPONSE_BY_STATUS: Record<number, string> =`

Status → the `components.responses` key that documents it.

## `apps/api/src/docs/openapi.ts`

### `const MODULES: ModuleDocs[] = [`

Assembles the OpenAPI document.

Every module contributes its own `*.docs.ts` beside its routes, and this file
turns them into one document. What it does _not_ do is let each module restate
shared truths: the security requirement comes from the mount point, the
parameter list is expanded from the same Zod schema `validate()` parses with,
and the error bodies come from `docs/errors.ts`. There is one place to change
each of those.

### `const MODULES: ModuleDocs[] = [`

── Reconstruction slice ──────────────────────────────────────────────────
Six modules, not eleven. `searchDocs`, `enquiriesDocs`, `vehiclesDocs` and
`billingDocs` describe routes that have not landed yet, and `catalogDocs`
never lands at all (decision D1) — the one surviving operation moved to
`configDocs`. `locationsDocs` described `GET /v1/cities`, which went with
the `cities` table: a dealership's city is text it typed, so there is no
list to serve.

**Each feature adds its own line here**, in the same PR as its routes. See
the API-documentation rule in CLAUDE.md §4.

### `const RAW_BINARY = '__raw_binary__'`

Tag order in the UI: buyer-facing, then dealer, then admin, then plumbing.

### `const RAW_BINARY = '__raw_binary__'`

The marker `media.docs.ts` uses for the one endpoint that takes raw bytes.

### `const DEALER_SECURITY = 'dealerSession'`

The security scheme names. Both describe the _same_ seam — the session
resolver — from the two mount points that use it.

### `function toOpenApiPath(expressPath: string): string`

`/v1/dealer/vehicles/:id` → `/v1/dealer/vehicles/{id}`.

The media route ends in `:width.webp`, a literal suffix on the parameter, so
the parameter name has to stop at the dot: `{width}.webp`.

### `function parametersFrom`

Splits an object schema into OpenAPI parameters.

The schema is the one the route actually validates with, so the required
flags, the patterns, the enums and the defaults are the real ones. A field
with a `default` is optional on the wire — that is exactly what `io: 'input'`
encodes, and why the parameters come from the input conversion.

### `required: location === 'path' ? true : required.has(name)`

A path parameter is required by definition, whatever the schema says.

### `const TRACE_HEADER: Parameter =`

Header parameters every request may carry. Documented once, applied widely.

### `function errorStatusesFor(operation: OperationSpec): number[]`

The statuses an operation can return, beyond the ones it declares.

Derived rather than listed per operation, because the answer follows from the
guard chain: anything behind `requireDealer` can 401, anything with a
permission can 403, anything that validates input can 400, and everything can 500. An operation's `errors` array only has to name the ones that are specific
to it — 404, 409, 422, 429.

### `const documented = new Set(parameters.map((parameter) => parameter.name))`

A params schema whose fields do not match the route's `:placeholders`

### `const documented = new Set(parameters.map((parameter) => parameter.name))`

means one of the two moved. Better to fail the build than to publish a

### `const documented = new Set(parameters.map((parameter) => parameter.name))`

reference that documents a parameter the route does not read.

### `parameters.push`

The media delivery route: its params are validated by a local schema, so

### `parameters.push`

they are described here rather than pulled from contracts.

### `responses[String(status)] ??= { $ref: `#/components/responses/${name}` }`

A declared success at this status wins — nothing declares one, but a

### `responses[String(status)] ??= { $ref: `#/components/responses/${name}` }`

silent overwrite would be the wrong failure mode if something ever did.

### `security: security ? [{ [security.scheme]: [] }] : []`

An empty array means "explicitly public", which is what a public endpoint

### `security: security ? [{ [security.scheme]: [] }] : []`

in an API with a global security requirement has to say.

### `serverUrl?: string`

Absolute base URL of this API. Defaults to `API_BASE_URL`.

## `apps/api/src/docs/schemas.ts`

### `export type JsonSchema = Record<string, unknown>`

`components.schemas`, generated from `@dealers-drive/contracts`.

The contracts package is already the single source of truth for every shape
that crosses the wire — the API validates with it and the web app parses with
it. Converting those same Zod schemas is therefore the only way the reference
can be _wrong the same way the code is wrong_, which is the only kind of
documentation worth having. Nothing here is transcribed by hand, so a renamed
field cannot drift out of the docs.

Two conversions, not one:

`io: 'input'` for request bodies, query strings and path params. This is
the pre-parse shape: `.default()` fields are optional, and
`z.coerce.number()` still accepts the string a query string
actually carries.
`io: 'output'` for responses. Post-parse: defaults are filled in and
therefore required.

Getting that backwards would document `?limit=` as a required integer and
`page.limit` as an optional one — exactly inverted.

### `export type JsonSchema = Record<string, unknown>`

A JSON Schema object as OpenAPI 3.0 accepts it.

### `const INPUT_SCHEMA_NAMES = [`

The schemas used as request input, by export name.

Kept explicit rather than inferred from a name pattern: the split decides
whether `limit` reads as required, and a silent misclassification is worse
than a list that has to be extended when a new input schema appears. The
builder throws if an operation references an input schema that is missing
from this list, so it cannot fall out of date unnoticed.

### `'IdParam'`

params

### `'CursorQuery'`

query

### `'OnboardingInput'`

bodies

### `] as const`

── Reconstruction slice ──────────────────────────────────────────────
The baseline lists 42 names. The rest are exported by contracts modules
that have not landed yet — `VehicleQuery` and `CreateVehicleInput` with
F055/F060, `ReorderMediaInput` with F035, the remaining admin and billing
bodies with tiers 8 and 11. `buildSchemaCatalogue()` throws when a name here is
not exported, so this list cannot silently run ahead of contracts: add the
name in the same PR that adds the schema.

### `function catalogue(): Catalogued[]`

Every Zod schema the contracts package exports, with its export name.

### `function typeOf(schema: ZodSchema): string`

The Zod internals needed to tell an object/enum apart from a bare string.

### `function isComponentWorthy(schema: ZodSchema): boolean`

`Uuid` is a bare `z.string().uuid()`. Promoting scalars to components would
turn every id field into a `$ref` and make the reference harder to read, not
easier — so only objects and enums become named components. Enums earn their
place: `FuelType` and `ListingStatus` are the vocabulary the whole API shares.

### `const JS_SAFE_INT = 9_007_199_254_740_991`

Strips the noise Zod's converter leaves behind.

`$id` OpenAPI 3.0 addresses components by path, and a
stray `$id` makes Swagger UI's model view show a
second, redundant name.
safe-integer min/max `z.number().int()` with no bounds emits
±9007199254740991. That is JavaScript's limit,
not the API's, and printing it on ~200 fields
implies a constraint nobody wrote.

### `schemas: Record<string, JsonSchema>`

Ready for `components.schemas`.

### `ref(name: string): JsonSchema`

`$ref` for a contracts export, by name. Throws if it is not a component.

### `resolved(name: string): JsonSchema`

The generated schema for a params/query object, for splitting into parameters.

### `isInput(name: string): boolean`

True when the name was generated with input (pre-parse) semantics.

### `const registry = z.registry<{ id: string }>()`

One call per group, sharing a registry, so a schema embedded in another

### `const registry = z.registry<{ id: string }>()`

becomes a `$ref` instead of being copied. That is what keeps the document

### `const registry = z.registry<{ id: string }>()`

readable: `VehicleListResponse.data` points at `VehicleCard`, once.

## `apps/api/src/docs/spec.ts`

### `export type HttpMethod = 'get' | 'post' | 'patch' | 'put' | 'delete'`

The vocabulary each module's `*.docs.ts` file writes in.

Deliberately small. Everything that can be derived — parameter lists from the
params/query schema, the error bodies, the security requirement from the
mount point — is derived by the builder rather than repeated per operation,
because 73 hand-maintained copies of the same 401 block is how a reference
starts disagreeing with itself.

### `export type Audience = 'public' | 'dealer' | 'admin' | 'internal'`

Which guard chain the route is mounted behind (`src/routes.ts`).

public `/v1/…` no principal is resolved
dealer `/v1/dealer/…` `requireDealer`
admin `/v1/admin/…` `requireAdmin`
internal `/health`, `/uploads`, `/media` — infrastructure, not API surface

### `schema?: string`

A contracts export name. Omit for 204 and for non-JSON responses.

### `inlineSchema?: JsonSchema`

An inline schema, for the two handlers whose shape is not in contracts.

### `contentType?: string`

Overrides `application/json` — used by the media and PDF routes.

### `path: string`

The Express path, mount included: `/v1/dealer/vehicles/:id`.

### `permission?: string`

The §8.3 permission `requirePermission` checks. Rendered into the
description, and the reason a 403 is documented on this operation.

### `requiresActiveDealer?: boolean`

True when `requireDealerActive` also runs (publishing paths).

### `params?: string`

Contracts export name for the path parameters.

### `query?: string`

Contracts export name for the query string.

### `inlineQuery?: { schema: JsonSchema; name: string }`

Inline query parameters, for the storage route whose schema is local.

### `required?: boolean`

Every documented body is required unless it says otherwise.

### `errors?: number[]`

Extra error statuses beyond the ones the builder infers.

### `rateLimit?: string`

Rendered as a note; the limits live in the route's `rateLimit()` call.

### `export interface ModuleDocs`

A module's contribution to the document.

## `apps/api/src/docs/tags.ts`

### `export const DOC_TAGS =`

The reference's tags — the section headings a reader sees in Swagger UI.

One definition rather than a string on each of the sixty-six operations: a tag
is the _same_ heading everywhere it appears, and a typo in one operation files
that endpoint under a section of its own. `buildOpenApiDocument` already
throws when `TAG_ORDER` names a tag no module declares, so the two lists below
cannot drift apart either.

### `export const TAG_ORDER: DocTag[] = [`

The order the sections appear in. A reader meets the product in this order.
