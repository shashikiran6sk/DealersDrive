import { CONTRACTS_VERSION } from '@dealers-drive/contracts';
import { describe, expect, it } from 'vitest';

import { buildOpenApiDocument } from '../../../src/docs/openapi.js';

/**
 * The reference is generated from the same code that serves the API, so the
 * failure mode is not "the document is wrong prose" but "the document
 * disagrees with the routes". These tests hold the joins:
 *
 *  · every `$ref` resolves — a dangling one renders as an empty box in
 *    Swagger UI and as a broken import in every client generator;
 *  · security comes from the *mount point*, so a `/v1/dealer/**` operation
 *    cannot be documented as public no matter what its module says;
 *  · the public vehicle responses never mention a phone number, which is the
 *    one disclosure CLAUDE.md rules out by name.
 *
 * Building the document is pure, so it is built once here and interrogated.
 */

const document = buildOpenApiDocument() as unknown as {
  openapi: string;
  info: { title: string; version: string; description?: string };
  servers: { url: string }[];
  tags: { name: string; description?: string }[];
  paths: Record<string, Record<string, Operation>>;
  components: {
    schemas: Record<string, unknown>;
    responses: Record<string, unknown>;
    securitySchemes?: Record<string, unknown>;
  };
};

interface Operation {
  operationId: string;
  summary?: string;
  description?: string;
  tags?: string[];
  security?: unknown[];
  parameters?: { name: string; in: string; required?: boolean }[];
  requestBody?: unknown;
  responses: Record<string, unknown>;
}

const METHODS = ['get', 'post', 'put', 'patch', 'delete'];

function operations(): { path: string; method: string; operation: Operation }[] {
  return Object.entries(document.paths).flatMap(([path, methods]) =>
    Object.entries(methods)
      .filter(([method]) => METHODS.includes(method))
      .map(([method, operation]) => ({ path, method, operation })),
  );
}

function refsIn(value: unknown, found: string[] = []): string[] {
  if (Array.isArray(value)) {
    for (const item of value) refsIn(item, found);
  } else if (value && typeof value === 'object') {
    for (const [key, item] of Object.entries(value)) {
      if (key === '$ref' && typeof item === 'string') found.push(item);
      else refsIn(item, found);
    }
  }
  return found;
}

describe('the document', () => {
  it('is OpenAPI 3.0', () => {
    expect(document.openapi).toMatch(/^3\.0\./);
  });

  /** One version, so a client can tell which contract shape it is holding. */
  it('carries the contracts package version', () => {
    expect(document.info.version).toBe(CONTRACTS_VERSION);
  });

  it('names the API and describes it', () => {
    expect(document.info.title).toBeTruthy();
    expect(document.info.description?.length ?? 0).toBeGreaterThan(100);
  });

  it('lists at least one server', () => {
    expect(document.servers.length).toBeGreaterThan(0);
    expect(document.servers[0]?.url).toBeTruthy();
  });

  it('describes every tag it uses', () => {
    const described = new Set(document.tags.map((tag) => tag.name));

    for (const { operation } of operations()) {
      for (const tag of operation.tags ?? []) {
        expect(described, `tag ${tag}`).toContain(tag);
      }
    }
  });

  /**
   * A tag with no operations is either stale or deliberate. `Authentication &
   * authorization` is the deliberate case — it exists to carry the permission
   * matrix, which belongs to no single endpoint. The rule is therefore "carry
   * operations or carry an explanation", not "carry operations".
   */
  it('gives every tag either operations or a description', () => {
    const used = new Set(operations().flatMap(({ operation }) => operation.tags ?? []));

    for (const tag of document.tags) {
      if (!used.has(tag.name)) {
        expect((tag.description ?? '').length, `tag ${tag.name}`).toBeGreaterThan(100);
      }
    }
  });

  it('is buildable more than once, and deterministically', () => {
    expect(JSON.stringify(buildOpenApiDocument())).toBe(JSON.stringify(buildOpenApiDocument()));
  });
});

describe('operations', () => {
  it('documents a substantial API, not a stub', () => {
    expect(operations().length).toBeGreaterThan(60);
  });

  it('gives every operation a unique operationId', () => {
    const ids = operations().map(({ operation }) => operation.operationId);

    expect(ids.every(Boolean)).toBe(true);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('gives every operation a summary and a tag', () => {
    for (const { path, method, operation } of operations()) {
      expect(operation.summary, `${method} ${path}`).toBeTruthy();
      expect(operation.tags?.length ?? 0, `${method} ${path}`).toBeGreaterThan(0);
    }
  });

  /** 3xx counts: the invoice PDF answers 302 to a signed URL rather than a body. */
  it('declares at least one non-error response on every operation', () => {
    for (const { path, method, operation } of operations()) {
      const success = Object.keys(operation.responses).filter((status) => Number(status) < 400);
      expect(success.length, `${method} ${path}`).toBeGreaterThan(0);
    }
  });

  /** Every failure is a problem document; an operation that lists none is under-described. */
  it('declares its error responses too', () => {
    for (const { path, method, operation } of operations()) {
      const errors = Object.keys(operation.responses).filter((status) => Number(status) >= 400);
      expect(errors.length, `${method} ${path}`).toBeGreaterThan(0);
    }
  });

  it('declares a path parameter for every templated segment', () => {
    for (const { path, method, operation } of operations()) {
      const templated = [...path.matchAll(/\{(\w+)\}/g)].map((match) => match[1]);
      const declared = (operation.parameters ?? [])
        .filter((parameter) => parameter.in === 'path')
        .map((parameter) => parameter.name);

      for (const name of templated) {
        expect(declared, `${method} ${path} → ${String(name)}`).toContain(name);
      }
    }
  });

  it('marks every path parameter required, as the spec demands', () => {
    for (const { path, method, operation } of operations()) {
      for (const parameter of operation.parameters ?? []) {
        if (parameter.in === 'path') {
          expect(parameter.required, `${method} ${path} → ${parameter.name}`).toBe(true);
        }
      }
    }
  });

  it('never puts a request body on a GET', () => {
    for (const { path, method, operation } of operations()) {
      if (method === 'get') {
        expect(operation.requestBody, `${method} ${path}`).toBeUndefined();
      }
    }
  });
});

describe('$refs', () => {
  /** A dangling ref is an empty box in the UI and a broken client generator. */
  it('all resolve to something the document actually defines', () => {
    const missing = [...new Set(refsIn(document))].filter((ref) => {
      const [, , section, name] = ref.split('/');
      const bucket = (document.components as Record<string, Record<string, unknown>>)[
        section ?? ''
      ];
      return !bucket || name === undefined || !(name in bucket);
    });

    expect(missing).toEqual([]);
  });

  it('points only inside this document', () => {
    for (const ref of refsIn(document)) {
      expect(ref.startsWith('#/components/')).toBe(true);
    }
  });

  it('defines the shared problem schema every error response points at', () => {
    expect(document.components.schemas).toHaveProperty('ProblemDetails');
  });

  it('leaves no unreferenced response component behind', () => {
    const used = new Set(refsIn(document));

    for (const name of Object.keys(document.components.responses)) {
      expect(used, `responses/${name}`).toContain(`#/components/responses/${name}`);
    }
  });
});

describe('security', () => {
  /**
   * `/v1/dealers` is the *public* dealer directory and `/v1/dealer` is the
   * signed-in console — one character apart, and a prefix match that conflated
   * them would quietly excuse the whole console from this check.
   */
  const isProtected = (path: string) =>
    path === '/v1/dealer' || path.startsWith('/v1/dealer/') || path.startsWith('/v1/admin/');

  /**
   * The security requirement is derived from the mount point, not restated per
   * module — so a new dealer route cannot be documented as public by omission.
   */
  it('marks every dealer and admin operation as requiring a session', () => {
    for (const { path, method, operation } of operations()) {
      if (isProtected(path)) {
        expect(operation.security, `${method} ${path}`).toBeDefined();
        expect((operation.security ?? []).length, `${method} ${path}`).toBeGreaterThan(0);
      }
    }
  });

  it('declares a 401 on every operation that requires a session', () => {
    for (const { path, method, operation } of operations()) {
      if (isProtected(path)) {
        expect(Object.keys(operation.responses), `${method} ${path}`).toContain('401');
      }
    }
  });

  it('defines the security scheme those operations reference', () => {
    expect(document.components.securitySchemes ?? {}).not.toEqual({});
  });

  it('leaves the public catalogue open', () => {
    const publicSearch = document.paths['/v1/vehicles']?.get;

    expect(publicSearch).toBeDefined();
    expect(publicSearch?.security ?? []).toEqual([]);
  });
});

describe('what the document must not say', () => {
  /**
   * CLAUDE.md, verbatim: "The public API must never expose a dealer's phone
   * number in ordinary public vehicle responses." A documented field is a
   * promise, so the document is the second place that rule can be broken.
   */
  it('never names a phone field on a public vehicle response', () => {
    const publicVehicleSchemas = Object.entries(document.components.schemas).filter(([name]) =>
      /^(VehicleCard|VehicleDetail|VehicleListResponse)/.test(name),
    );

    expect(publicVehicleSchemas.length).toBeGreaterThan(0);

    for (const [name, schema] of publicVehicleSchemas) {
      expect(JSON.stringify(schema), name).not.toMatch(/"phone"/i);
    }
  });

  /**
   * The provider is named in prose — the billing description explains that the
   * development provider settles through the same function a Razorpay webhook
   * would call, which is worth saying. What must not exist is a *route*: no
   * gateway callback, no checkout page, no provider-specific endpoint.
   */
  it('exposes no Razorpay route', () => {
    for (const { path, operation } of operations()) {
      expect(path.toLowerCase(), path).not.toContain('razorpay');
      expect(operation.operationId.toLowerCase(), path).not.toContain('razorpay');
    }
  });

  it('exposes no path outside /v1, /health and /api', () => {
    for (const path of Object.keys(document.paths)) {
      expect(path, path).toMatch(/^\/(v1|health|api|media|uploads)/);
    }
  });
});
