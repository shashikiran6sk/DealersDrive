import { afterAll, beforeAll, describe, expect, it } from 'vitest';

/**
 * The OpenAPI document is only worth having if it describes *this* API.
 *
 * Two directions, and both matter:
 *
 *   1. Every documented operation is really routed. This is what stops the
 *      reference from growing an endpoint that does not exist — the failure mode
 *      that makes a client developer waste an afternoon.
 *   2. Every route in the app is documented. This is what stops the reference
 *      from silently falling behind the code.
 *
 * Direction 1 is checked by *calling* each documented path: the not-found
 * middleware answers with a distinctive `No route matches …` detail, so a
 * documented path that is not routed is unmistakable. Direction 2 is checked by
 * walking the real router tree.
 *
 * The docs are off under test by default, so this file turns them on before the
 * module graph loads — same trick as `rate-limit.test.ts`, and vitest's
 * per-file module registry keeps it from leaking.
 */
process.env.DOCS_ENABLED = 'true';

const { createHarness, DEALER_A } = await import('./harness.js');
const { buildOpenApiDocument } = await import('../src/docs/openapi.js');

type Harness = Awaited<ReturnType<typeof createHarness>>;

interface OpenApiDocument {
  openapi: string;
  info: { title: string; version: string; description: string };
  servers: { url: string }[];
  tags: { name: string; description: string }[];
  paths: Record<string, Record<string, OpenApiOperation>>;
  components: {
    schemas: Record<string, unknown>;
    responses: Record<string, unknown>;
    securitySchemes: Record<string, unknown>;
  };
}

interface OpenApiOperation {
  operationId: string;
  tags: string[];
  summary: string;
  description: string;
  parameters: { name: string; in: string; required: boolean; schema: unknown }[];
  requestBody?: { required: boolean; content: Record<string, { schema: unknown }> };
  responses: Record<string, unknown>;
  security: Record<string, unknown>[];
}

const document = buildOpenApiDocument() as unknown as OpenApiDocument;

/** Every documented operation, flattened. */
const operations = Object.entries(document.paths).flatMap(([path, methods]) =>
  Object.entries(methods).map(([method, operation]) => ({ path, method, operation })),
);

/** A concrete value per path parameter, so a documented path can be called. */
const PARAM_VALUES: Record<string, string> = {
  id: '2f9a6f1e-0000-4000-8000-000000000000',
  idOrSlug: 'no-such-car',
  slug: 'no-such-dealership',
  type: 'GST_CERTIFICATE',
  key: 'listing.minPhotos',
  mediaId: '2f9a6f1e-0000-4000-8000-000000000000',
  width: '640',
};

function concrete(path: string): string {
  return path.replace(/\{([^}]+)\}/g, (_match, name: string) => {
    const value = PARAM_VALUES[name];
    if (!value) throw new Error(`openapi test: no sample value for path parameter "${name}"`);
    return value;
  });
}

describe('the OpenAPI document', () => {
  it('is a valid OpenAPI 3.0 envelope', () => {
    expect(document.openapi).toBe('3.0.3');
    expect(document.info.title).toBe('Dealers-Drive API');
    expect(document.info.version).toMatch(/^\d+\.\d+\.\d+$/);
    expect(document.servers[0]?.url).toBeTruthy();
    expect(Object.keys(document.paths).length).toBeGreaterThan(60);
  });

  it('resolves every $ref', () => {
    const json = JSON.stringify(document);
    const refs = new Set([...json.matchAll(/"\$ref":"([^"]+)"/g)].map((match) => match[1] ?? ''));
    expect(refs.size).toBeGreaterThan(100);

    for (const ref of refs) {
      expect(ref.startsWith('#/'), `${ref} is not a local ref`).toBe(true);

      let node: unknown = document;
      for (const segment of ref.replace(/^#\//, '').split('/')) {
        node = (node as Record<string, unknown> | undefined)?.[segment];
      }
      expect(node, `dangling $ref: ${ref}`).toBeDefined();
    }
  });

  it('describes every operation fully', () => {
    for (const { path, method, operation } of operations) {
      const where = `${method.toUpperCase()} ${path}`;

      expect(operation.operationId, `${where} has no operationId`).toBeTruthy();
      expect(operation.summary, `${where} has no summary`).toBeTruthy();
      // Not just present — long enough to say something. A one-line restatement
      // of the summary is not documentation.
      expect(operation.description.length, `${where} has a thin description`).toBeGreaterThan(60);
      expect(operation.tags.length, `${where} has no tag`).toBe(1);

      // Every operation documents at least one success and the 500.
      const statuses = Object.keys(operation.responses).map(Number);
      expect(
        statuses.some((status) => status < 400),
        `${where} documents no success`,
      ).toBe(true);
      expect(statuses, `${where} does not document 500`).toContain(500);

      // Path parameters must all be declared, or Swagger UI cannot build a URL.
      const declared = new Set(
        operation.parameters.filter((parameter) => parameter.in === 'path').map((p) => p.name),
      );
      for (const name of [...path.matchAll(/\{([^}]+)\}/g)].map((match) => match[1] ?? '')) {
        expect(declared, `${where} does not document path parameter ${name}`).toContain(name);
      }
    }
  });

  it('marks each operation with the security its mount point enforces', () => {
    for (const { path, method, operation } of operations) {
      const where = `${method.toUpperCase()} ${path}`;

      // `/v1/dealer` and `/v1/dealer/…` are the dealer console; `/v1/dealers` is
      // the *public* directory and merely shares a prefix as a string.
      const isDealerConsole = path === '/v1/dealer' || path.startsWith('/v1/dealer/');

      // The three `/v1/auth` paths behind `requireSignedIn`. The rest of that
      // prefix — the Google redirects and the admin sign-in — must be public,
      // and the `else` below is what proves it.
      const isGuardedSession =
        path === '/v1/auth/me' || path === '/v1/auth/logout' || path === '/v1/auth/onboarding';

      if (isDealerConsole || isGuardedSession) {
        expect(operation.security, `${where} should require a dealer session`).toEqual([
          { dealerSession: [] },
        ]);
        expect(Object.keys(operation.responses), `${where} should document 401`).toContain('401');
      } else if (path.startsWith('/v1/admin')) {
        expect(operation.security, `${where} should require an admin session`).toEqual([
          { adminSession: [] },
        ]);
        expect(Object.keys(operation.responses), `${where} should document 401`).toContain('401');
      } else {
        // An empty array is how OpenAPI says "explicitly public".
        expect(operation.security, `${where} should be public`).toEqual([]);
      }
    }
  });

  it('documents both session schemes and no bearer scheme it does not have', () => {
    const schemes = document.components.securitySchemes;
    expect(Object.keys(schemes).sort()).toEqual(['adminSession', 'dealerSession']);

    // There is no JWT in this build. A `bearer` scheme here would be a documented
    // mechanism that does not exist, which is worse than no scheme at all.
    expect(JSON.stringify(schemes)).not.toContain('bearer');
  });

  it('carries every documented input schema as a component', () => {
    const schemas = document.components.schemas;

    for (const { path, method, operation } of operations) {
      const body = operation.requestBody?.content['application/json']?.schema as
        { $ref?: string } | undefined;
      if (!body?.$ref) continue;

      const name = body.$ref.replace('#/components/schemas/', '');
      expect(
        schemas,
        `${method.toUpperCase()} ${path} references a missing ${name}`,
      ).toHaveProperty(name);
    }
  });

  it('exposes the shared enums as components, so clients can generate them', () => {
    for (const name of [
      'FuelType',
      'Transmission',
      'BodyType',
      'ListingStatus',
      'DisplayStatus',
      'DealerStatus',
      'CreditReason',
      'EnquiryStatus',
      'MediaStatus',
      'OrderStatus',
    ]) {
      expect(document.components.schemas, `missing enum ${name}`).toHaveProperty(name);
    }
  });

  it('documents the pagination and error envelopes once', () => {
    for (const name of ['OffsetPage', 'CursorPage', 'CursorQuery', 'ProblemDetails']) {
      expect(document.components.schemas, `missing ${name}`).toHaveProperty(name);
    }
    expect(Object.keys(document.components.responses).sort()).toEqual([
      'BadRequest',
      'Conflict',
      'Forbidden',
      'InternalServerError',
      'NotFound',
      'ServiceUnavailable',
      'TooManyRequests',
      'Unauthorized',
      'UnprocessableEntity',
    ]);
  });

  /**
   * The query grammar is the easiest thing to get wrong by hand, so it is worth
   * asserting that it came from the schema: `?limit=` has a default and is
   * therefore optional, `?page=` is bounded, and the enum values are the real
   * lowercase slugs the API accepts rather than the uppercase enum names.
   */
  it('derives query parameters from the Zod schema the route validates with', () => {
    const search = document.paths['/v1/vehicles']?.get;
    expect(search).toBeDefined();

    const byName = new Map(search?.parameters.map((parameter) => [parameter.name, parameter]));

    const limit = byName.get('limit');
    expect(limit?.in).toBe('query');
    expect(limit?.required).toBe(false);
    expect(limit?.schema).toMatchObject({ type: 'integer', minimum: 1, maximum: 48, default: 24 });

    expect(byName.get('sort')?.schema).toMatchObject({
      enum: ['relevance', 'price_asc', 'price_desc', 'year_desc', 'km_asc', 'newest'],
    });
    expect(byName.get('city')?.schema).toMatchObject({ pattern: '^[a-z0-9-]+$' });
  });
});

describe('the OpenAPI document against the running app', () => {
  let h: Harness;

  beforeAll(async () => {
    h = await createHarness();
    h.actAs(DEALER_A);
  });

  afterAll(async () => {
    await h.close();
  });

  it('serves the UI and both document formats at /api/docs', async () => {
    const ui = await h.agent().get('/api/docs/').expect(200);
    expect(ui.headers['content-type']).toContain('text/html');
    expect(ui.text).toContain('swagger-ui');

    const json = await h.agent().get('/api/docs/openapi.json').expect(200);
    expect(json.headers['content-type']).toContain('application/json');
    expect(json.body.openapi).toBe('3.0.3');
    expect(Object.keys(json.body.paths as object)).toHaveLength(Object.keys(document.paths).length);

    const yaml = await h.agent().get('/api/docs/openapi.yaml').expect(200);
    expect(yaml.headers['content-type']).toContain('yaml');
    expect(yaml.text.startsWith('openapi: 3.0.3')).toBe(true);
  });

  /**
   * Direction 1: nothing is invented.
   *
   * Each documented path is called with throwaway parameter values. The response
   * can be anything — 400, 401, 404, 422 — except the not-found middleware's
   * `No route matches …`, which is what an undocumented-into-existence endpoint
   * would produce.
   */
  it('routes every documented operation', async () => {
    const missing: string[] = [];

    for (const { path, method, operation } of operations) {
      // The docs routes themselves are not in the document, and the raw-upload
      // route needs a valid signature to get past its query schema — neither
      // tells us anything about route existence that its own test does not.
      if (path.startsWith('/api/docs')) continue;

      const url = concrete(path);
      const request = h.agent() as unknown as Record<
        string,
        (target: string) => { send: (body: unknown) => Promise<{ body: { detail?: string } }> }
      >;

      const response = await request[method]!(url).send({});
      const detail = response.body?.detail ?? '';

      if (detail.startsWith('No route matches')) {
        missing.push(`${method.toUpperCase()} ${path} (${operation.operationId})`);
      }
    }

    expect(missing, 'documented but not routed').toEqual([]);
  });

  /**
   * Direction 2: nothing is missed.
   *
   * Express 5 compiles a mount path into a matcher function and does not keep the
   * string, so the full path cannot be recovered from the router tree. The bare
   * per-router paths can be, and comparing those against the documented paths
   * with their mount prefix removed still catches a route that has no
   * documentation at all — which is the failure this test is for. Direction 1
   * above is what confirms the prefixes.
   */
  it('documents every route the app registers', () => {
    // Longest first: `/v1/auth` has to beat `/v1`, or `/v1/auth/me` would be
    // reduced to `/auth/me` and never match the router's own `/me`.
    const MOUNTS = ['/v1/dealer', '/v1/admin', '/v1/auth', '/v1', '/health', ''];

    const documented = new Set<string>();
    for (const { path, method } of operations) {
      const mount = MOUNTS.find(
        (candidate) => candidate !== '' && (path === candidate || path.startsWith(`${candidate}/`)),
      );
      const bare = mount ? path.slice(mount.length) : path;
      documented.add(`${method.toUpperCase()} ${(bare || '/').replace(/\{([^}]+)\}/g, ':$1')}`);
    }

    // Swagger UI's own routes are not API surface and are not in the document.
    const DOCS_ROUTES = ['GET /openapi.json', 'GET /openapi.yaml', 'GET /index.css'];

    const undocumented = [...routesOf(h.app)]
      .filter((route) => !DOCS_ROUTES.includes(route))
      .filter((route) => !documented.has(route))
      .sort();

    expect(undocumented, 'routed but not documented').toEqual([]);
  });
});

/** Walks the Express router tree collecting `METHOD /bare/path` per route. */
function routesOf(app: Harness['app']): Set<string> {
  interface Layer {
    route?: { path: string; methods: Record<string, boolean> };
    handle?: { stack?: Layer[] };
  }

  const found = new Set<string>();

  const walk = (stack: Layer[]): void => {
    for (const layer of stack) {
      if (layer.route) {
        for (const method of Object.keys(layer.route.methods)) {
          if (method === '_all') continue;
          found.add(`${method.toUpperCase()} ${layer.route.path}`);
        }
        continue;
      }
      if (layer.handle?.stack) walk(layer.handle.stack);
    }
  };

  walk((app as unknown as { router: { stack: Layer[] } }).router.stack);
  return found;
}
