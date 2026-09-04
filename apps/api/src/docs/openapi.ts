import { CONTRACTS_VERSION } from '@dealers-drive/contracts';

import { env } from '../config/env.js';
import { authDocs } from '../modules/auth/auth.docs.js';
import { adminDocs } from '../modules/admin/admin.docs.js';
import { configDocs } from '../modules/config/config.docs.js';
import { dealersDocs } from '../modules/dealers/dealers.docs.js';
import { healthDocs } from '../modules/health/health.docs.js';
import { locationsDocs } from '../modules/locations/locations.docs.js';
import { mediaDocs, storageDocs } from '../modules/media/media.docs.js';
import { ERROR_RESPONSE_BY_STATUS, ERROR_RESPONSES } from './errors.js';
import { buildSchemaCatalogue, type JsonSchema, type SchemaCatalogue } from './schemas.js';
import type { Audience, ModuleDocs, OperationSpec, ResponseSpec } from './spec.js';

/**
 * Assembles the OpenAPI document.
 *
 * Every module contributes its own `*.docs.ts` beside its routes, and this file
 * turns them into one document. What it does *not* do is let each module restate
 * shared truths: the security requirement comes from the mount point, the
 * parameter list is expanded from the same Zod schema `validate()` parses with,
 * and the error bodies come from `docs/errors.ts`. There is one place to change
 * each of those.
 */

/*
 * ── Reconstruction slice ──────────────────────────────────────────────────
 * Seven modules, not eleven. `searchDocs`, `enquiriesDocs`, `vehiclesDocs` and
 * `billingDocs` describe routes that have not landed yet, and `catalogDocs`
 * never lands at all (decision D1) — its two surviving operations moved to
 * `locationsDocs` and `configDocs`.
 *
 * **Each feature adds its own line here**, in the same PR as its routes. See
 * the API-documentation rule in CLAUDE.md §4.
 */
const MODULES: ModuleDocs[] = [
  authDocs,
  locationsDocs,
  configDocs,
  dealersDocs,
  adminDocs,
  mediaDocs,
  healthDocs,
  storageDocs,
];

/** Tag order in the UI: buyer-facing, then dealer, then admin, then plumbing. */
const TAG_ORDER = [
  'Authentication',
  'Locations',
  'Platform configuration',
  'Dealer account',
  'Admin',
  'Media',
  'Health',
  'Storage (local only)',
];

/** The marker `media.docs.ts` uses for the one endpoint that takes raw bytes. */
const RAW_BINARY = '__raw_binary__';

/**
 * The security scheme names. Both describe the *same* seam — the session
 * resolver — from the two mount points that use it.
 */
const DEALER_SECURITY = 'dealerSession';
const ADMIN_SECURITY = 'adminSession';

interface Parameter {
  name: string;
  in: 'path' | 'query' | 'header';
  required: boolean;
  description?: string;
  schema: JsonSchema;
  example?: unknown;
}

/**
 * `/v1/dealer/vehicles/:id` → `/v1/dealer/vehicles/{id}`.
 *
 * The media route ends in `:width.webp`, a literal suffix on the parameter, so
 * the parameter name has to stop at the dot: `{width}.webp`.
 */
function toOpenApiPath(expressPath: string): string {
  return expressPath.replace(/:([A-Za-z0-9_]+)/g, '{$1}');
}

function pathParamNames(expressPath: string): string[] {
  return [...expressPath.matchAll(/:([A-Za-z0-9_]+)/g)].map((match) => match[1] ?? '');
}

/**
 * Splits an object schema into OpenAPI parameters.
 *
 * The schema is the one the route actually validates with, so the required
 * flags, the patterns, the enums and the defaults are the real ones. A field
 * with a `default` is optional on the wire — that is exactly what `io: 'input'`
 * encodes, and why the parameters come from the input conversion.
 */
function parametersFrom(
  schema: JsonSchema,
  location: 'path' | 'query',
  only?: string[],
): Parameter[] {
  const properties = (schema.properties ?? {}) as Record<string, JsonSchema>;
  const required = new Set((schema.required as string[] | undefined) ?? []);

  return Object.entries(properties)
    .filter(([name]) => (only ? only.includes(name) : true))
    .map(([name, property]) => {
      const { description, ...rest } = property;
      return {
        name,
        in: location,
        // A path parameter is required by definition, whatever the schema says.
        required: location === 'path' ? true : required.has(name),
        ...(typeof description === 'string' ? { description } : {}),
        schema: rest,
      };
    });
}

/** Header parameters every request may carry. Documented once, applied widely. */
const TRACE_HEADER: Parameter = {
  name: 'X-Request-Id',
  in: 'header',
  required: false,
  description:
    'Optional client-supplied correlation id. Echoed back as `x-trace-id` on the response ' +
    'and stamped on every log line for the request, so a client can quote it in a bug ' +
    'report. Generated per request if omitted.',
  schema: { type: 'string', maxLength: 120 },
};

function securityFor(audience: Audience): { name: string; scheme: string } | null {
  if (audience === 'dealer') return { name: 'dealer', scheme: DEALER_SECURITY };
  if (audience === 'admin') return { name: 'admin', scheme: ADMIN_SECURITY };
  return null;
}

/**
 * The statuses an operation can return, beyond the ones it declares.
 *
 * Derived rather than listed per operation, because the answer follows from the
 * guard chain: anything behind `requireDealer` can 401, anything with a
 * permission can 403, anything that validates input can 400, and everything can
 * 500. An operation's `errors` array only has to name the ones that are specific
 * to it — 404, 409, 422, 429.
 */
function errorStatusesFor(operation: OperationSpec): number[] {
  const statuses = new Set<number>(operation.errors ?? []);

  if (operation.params || operation.query || operation.requestBody || operation.inlineQuery) {
    statuses.add(400);
  }
  if (operation.audience === 'dealer' || operation.audience === 'admin') {
    statuses.add(401);
    statuses.add(403);
  }
  statuses.add(500);

  return [...statuses].sort((a, b) => a - b);
}

function describe(operation: OperationSpec): string {
  const notes: string[] = [operation.description];

  if (operation.permission) {
    notes.push(
      `**Permission** \`${operation.permission}\` — see the role table in the ` +
        '`Authentication & authorization` section. A seat without it gets a 403.',
    );
  }
  if (operation.requiresActiveDealer) {
    notes.push(
      '**Requires an ACTIVE dealership.** A dealer awaiting verification or under suspension ' +
        'can still read their console but cannot publish; this returns 403 `DEALER_NOT_ACTIVE`.',
    );
  }
  if (operation.rateLimit) {
    notes.push(`**Rate limit** ${operation.rateLimit}.`);
  }

  return notes.join('\n\n');
}

function contentFor(
  response: ResponseSpec,
  catalogue: SchemaCatalogue,
): Record<string, unknown> | undefined {
  const schema = response.schema
    ? catalogue.ref(response.schema)
    : (response.inlineSchema ?? undefined);

  if (!schema) return undefined;

  return {
    [response.contentType ?? 'application/json']: {
      schema,
      ...(response.example === undefined ? {} : { example: response.example }),
    },
  };
}

function buildOperation(
  operation: OperationSpec,
  catalogue: SchemaCatalogue,
): Record<string, unknown> {
  const parameters: Parameter[] = [];

  const declaredPathParams = pathParamNames(operation.path);
  if (operation.params) {
    const schema = catalogue.resolved(operation.params);
    parameters.push(...parametersFrom(schema, 'path', declaredPathParams));

    // A params schema whose fields do not match the route's `:placeholders`
    // means one of the two moved. Better to fail the build than to publish a
    // reference that documents a parameter the route does not read.
    const documented = new Set(parameters.map((parameter) => parameter.name));
    const missing = declaredPathParams.filter((name) => !documented.has(name));
    if (missing.length > 0) {
      throw new Error(
        `docs: ${operation.method.toUpperCase()} ${operation.path} has path parameters ` +
          `${missing.join(', ')} that ${operation.params} does not declare.`,
      );
    }
  } else if (declaredPathParams.length > 0) {
    // The media delivery route: its params are validated by a local schema, so
    // they are described here rather than pulled from contracts.
    parameters.push(
      ...declaredPathParams.map<Parameter>((name) => ({
        name,
        in: 'path',
        required: true,
        schema:
          name === 'width'
            ? { type: 'integer', enum: [320, 640, 1024, 1600] }
            : { type: 'string', format: 'uuid' },
      })),
    );
  }

  if (operation.query) {
    parameters.push(...parametersFrom(catalogue.resolved(operation.query), 'query'));
  }
  if (operation.inlineQuery) {
    parameters.push(...parametersFrom(operation.inlineQuery.schema, 'query'));
  }

  parameters.push(TRACE_HEADER);

  const responses: Record<string, unknown> = {};

  for (const response of operation.responses) {
    const content = contentFor(response, catalogue);
    responses[String(response.status)] = {
      description: response.description,
      ...(response.headers ? { headers: response.headers } : {}),
      ...(content ? { content } : {}),
    };
  }

  for (const status of errorStatusesFor(operation)) {
    const name = ERROR_RESPONSE_BY_STATUS[status];
    if (!name) throw new Error(`docs: no shared response for status ${status}.`);
    // A declared success at this status wins — nothing declares one, but a
    // silent overwrite would be the wrong failure mode if something ever did.
    responses[String(status)] ??= { $ref: `#/components/responses/${name}` };
  }

  const security = securityFor(operation.audience);

  const requestBody = operation.requestBody
    ? {
        required: operation.requestBody.required ?? true,
        ...(operation.requestBody.description
          ? { description: operation.requestBody.description }
          : {}),
        content:
          operation.requestBody.schema === RAW_BINARY
            ? { 'application/octet-stream': { schema: { type: 'string', format: 'binary' } } }
            : {
                'application/json': {
                  schema: catalogue.ref(operation.requestBody.schema),
                  ...(operation.requestBody.example === undefined
                    ? {}
                    : { example: operation.requestBody.example }),
                },
              },
      }
    : undefined;

  return {
    operationId: operation.operationId,
    tags: [operation.tag],
    summary: operation.summary,
    description: describe(operation),
    ...(operation.deprecated ? { deprecated: true } : {}),
    parameters,
    ...(requestBody ? { requestBody } : {}),
    responses,
    // An empty array means "explicitly public", which is what a public endpoint
    // in an API with a global security requirement has to say.
    security: security ? [{ [security.scheme]: [] }] : [],
  };
}

const AUTH_DESCRIPTION = `
Dealers-Drive resolves identity through a **session resolver** at the edge of the request
(\`SessionResolver\`, \`src/modules/auth/session.port.js\`), and passes the resolved principal
inward. Nothing downstream reads an identity from a client: \`dealerId\` is a property of the
principal, never a field in a body, a query string or a path.

### Sign-in is real

Both flows issue an opaque \`dd_session\` cookie backed by a row in \`sessions\`:

- **Dealers** — Google OAuth 2.0, authorization code + PKCE + OIDC nonce. The account is
  matched on \`provider + sub\`, never on the email address.
- **Admins** — email and an Argon2id password hash, on a separate 12-hour session with
  \`scope = ADMIN\`. A dealer cookie can never reach an admin route and vice versa, even for
  one person holding both seats.

Because the session lives in a row rather than in a signed token, sign-out and revocation are
immediate and global rather than one browser forgetting a value.

**"Try it out" needs a real session.** Sign in through the app first — the browser will hold
the cookie and Swagger UI will send it. The \`Authorize\` button describes the cookie for
completeness; there is no bearer token to paste.

\`AUTH_MODE=dev\` is a documented local escape hatch that swaps the resolver for one reading
\`DEV_DEALER_SLUG\` server-side, for a developer who has not configured Google credentials.
\`env.ts\` refuses it in production. It changes *only* the identity step — every authorization
check below runs exactly the same way.

### What authorization does regardless

- \`dealerId\` is a property of the resolved principal. It is accepted in no body, query or
  path, and no input schema declares it (rule 1).
- Dealer-scoped repositories take \`dealerId\` as their first argument, so an unscoped query
  is a type error.
- Cross-tenant reads answer **404, not 403** — a 403 confirms the id is real and is an
  enumeration oracle.
- \`requirePermission\` enforces the table below, and the service re-checks ownership inside
  the transaction that writes, so there is no gap between "you may" and "this row is yours".

### Dealer permissions (§8.3)

| Permission | OWNER | MANAGER | SALES |
| --- | :-: | :-: | :-: |
| \`vehicle:read\` | ✓ | ✓ | ✓ |
| \`vehicle:write\` | ✓ | ✓ | |
| \`vehicle:delete\` | ✓ | ✓ | |
| \`listing:submit\` | ✓ | ✓ | |
| \`listing:renew\` | ✓ | ✓ | |
| \`enquiry:read\` | ✓ | ✓ | ✓ |
| \`enquiry:update\` | ✓ | ✓ | ✓ |
| \`photo:request\` | ✓ | ✓ | |
| \`dealer:update\` | ✓ | | |
| \`document:upload\` | ✓ | | |
| \`billing:read\` | ✓ | ✓ | |
| \`billing:purchase\` | ✓ | | |
| \`member:manage\` | ✓ | | |

### Admin permissions

| Permission | SUPER_ADMIN | MODERATOR | SUPPORT |
| --- | :-: | :-: | :-: |
| \`admin:dealer:approve\` | ✓ | ✓ | |
| \`admin:document:review\` | ✓ | ✓ | |
| \`admin:listing:moderate\` | ✓ | ✓ | |
| \`admin:media:upload\` | ✓ | ✓ | |
| \`admin:credit:grant\` | ✓ | | |
| \`admin:payment:read\` | ✓ | ✓ | ✓ |
| \`admin:payment:refund\` | ✓ | | |
| \`admin:config:write\` | ✓ | | |
| \`admin:audit:read\` | ✓ | ✓ | ✓ |
| \`admin:metrics:read\` | ✓ | ✓ | ✓ |
`.trim();

const DESCRIPTION = `
The REST API behind Dealers-Drive — a B2B2C used-car marketplace for Tamil Nadu, where
verified dealers list their inventory and buyers browse it without an account.

**This reference is generated from the code.** Every schema below is converted from
\`@dealers-drive/contracts\`, the same Zod schemas the API validates requests with and the web
app parses responses with. A renamed field cannot drift out of this document, because there is
no second copy of it to drift from.

### Three mount points, three guard chains

| Prefix | Who | Notes |
| --- | --- | --- |
| \`/v1/…\` | anyone | No session. IP rate-limited. Never returns a dealer's phone number. |
| \`/v1/dealer/…\` | a dealer seat | Scoped to one dealership, resolved server-side. |
| \`/v1/admin/…\` | a platform admin | Cross-tenant, and every write is audit-logged. |

\`/health\` and the storage routes sit outside \`/v1\` on purpose: infrastructure probes them,
not clients, so they must not move when the API version does.

### Conventions worth knowing before you read further

- **Money is integer paise.** \`pricePaise: 645000\` is ₹6,450. There are no float amounts
  anywhere, in either direction.
- **Formatted values travel with raw ones.** Responses carry \`pricePaise\` *and*
  \`priceLabel: "₹6.45 Lakh"\`, so the four surfaces that show a price cannot disagree about
  rounding.
- **Every input schema is \`.strict()\`.** An unknown field or query parameter is a 400 naming
  it, never a silent ignore — silent ignoring hides client bugs for months.
- **One error shape.** Every failure is an RFC 9457 problem document with
  \`application/problem+json\` and a machine-readable \`code\`. Switch on \`code\`, never on
  \`detail\`.
- **Public visibility has one rule.** A car appears publicly only when
  \`listing.status = APPROVED\` **and** \`dealer.status = ACTIVE\`. Anything else is a 404 to a
  buyer, and every count in the public API is derived from the same rows.
- **A dealer's phone number appears in exactly one response**, from
  \`POST /v1/vehicles/{id}/reveal-contact\` — not yet built.

### This document covers what is built, and only that

The repository is being reconstructed feature by feature, so this reference grows with it.
An endpoint described in the product specification but absent here has not landed yet; it is
never the case that an endpoint exists and is missing from this page, because a feature that
adds a route adds its documentation in the same pull request.

Currently documented: authentication and sessions, cities, public platform configuration, the
media presign/commit pipeline, the health probes, and the local storage stand-ins. Vehicles,
listings, search, enquiries, billing and the admin surface are still to come.
`.trim();

export interface OpenApiOptions {
  /** Absolute base URL of this API. Defaults to `API_BASE_URL`. */
  serverUrl?: string;
}

export function buildOpenApiDocument(options: OpenApiOptions = {}): Record<string, unknown> {
  const catalogue = buildSchemaCatalogue();
  const paths: Record<string, Record<string, unknown>> = {};
  const seenOperationIds = new Set<string>();

  for (const module of MODULES) {
    for (const operation of module.operations) {
      if (seenOperationIds.has(operation.operationId)) {
        throw new Error(`docs: duplicate operationId "${operation.operationId}".`);
      }
      seenOperationIds.add(operation.operationId);

      const path = toOpenApiPath(operation.path);
      paths[path] ??= {};
      const entry = paths[path];
      if (entry[operation.method]) {
        throw new Error(`docs: ${operation.method.toUpperCase()} ${path} is documented twice.`);
      }
      entry[operation.method] = buildOperation(operation, catalogue);
    }
  }

  return {
    openapi: '3.0.3',
    info: {
      title: 'Dealers-Drive API',
      version: CONTRACTS_VERSION,
      description: DESCRIPTION,
      contact: { name: 'Dealers-Drive support', email: env.SUPPORT_EMAIL },
    },
    servers: [
      {
        url: options.serverUrl ?? env.API_BASE_URL,
        description: `${env.APP_ENV} (${env.NODE_ENV})`,
      },
    ],
    tags: [
      {
        name: 'Authentication & authorization',
        description: AUTH_DESCRIPTION,
      },
      ...TAG_ORDER.map((name) => {
        const module = MODULES.find((candidate) => candidate.tag === name);
        if (!module) throw new Error(`docs: TAG_ORDER names an unknown tag "${name}".`);
        return { name, description: module.description };
      }),
    ],
    paths,
    components: {
      securitySchemes: {
        [DEALER_SECURITY]: {
          type: 'apiKey',
          in: 'cookie',
          name: 'dd_session',
          description:
            'The dealer session cookie the production resolver will read. **Not required by ' +
            'this build** — the development resolver reads `DEV_DEALER_SLUG` server-side, so ' +
            'protected endpoints answer without any credential and a value entered in ' +
            '`Authorize` is ignored. See the *Authentication & authorization* section.',
        },
        [ADMIN_SECURITY]: {
          type: 'apiKey',
          in: 'cookie',
          name: 'dd_session',
          description:
            'The same session cookie, resolved as a platform admin. **Not required by this ' +
            'build** — the development resolver reads `DEV_ADMIN_EMAIL` server-side.',
        },
      },
      schemas: catalogue.schemas,
      responses: ERROR_RESPONSES,
    },
  };
}
