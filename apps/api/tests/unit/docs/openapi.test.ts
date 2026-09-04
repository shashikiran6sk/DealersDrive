import express, { type Request, type Response } from 'express';
import { describe, expect, it } from 'vitest';

import type { Container } from '../../../src/container.js';
import { buildOpenApiDocument } from '../../../src/docs/openapi.js';
import { createRoutes } from '../../../src/routes.js';

/**
 * The reference cannot fall behind the routes.
 *
 * `buildOpenApiDocument()` already throws on the failures it can see from the
 * inside — a duplicate `operationId`, a path parameter the params schema does
 * not declare, an input schema contracts no longer exports. What it cannot see
 * is the failure that actually happens: somebody mounts a route and does not
 * write the `*.docs.ts` entry for it. Nothing in the builder notices, because
 * the builder only reads what modules gave it.
 *
 * So this file walks the assembled Express router — the same one `server.ts`
 * mounts — and compares it against the document, in both directions:
 *
 *   a mounted route with no operation   → the PR that added it skipped the docs
 *   an operation with no mounted route  → the docs describe something removed
 *
 * The second direction matters as much as the first. A reference that lists an
 * endpoint which 404s is worse than one that omits it, because a client writes
 * code against it.
 *
 * This is the mechanical half of the API-documentation rule in CLAUDE.md §4.
 * The rule asks for prose in the right place; this asks whether it is there.
 */

/**
 * Every route the assembled router actually serves, as `METHOD /full/path`.
 *
 * Express 5 keeps a mount path inside the matcher's closure — a layer exposes
 * only a `match(input)` function, which cannot report a prefix without already
 * being given a matching input. So the prefixes are recorded as they are
 * declared: `Router.prototype.use` is wrapped for the duration of
 * `createRoutes()`, mapping each mounted child router to the path it was
 * mounted at. The patch is removed in a `finally`, so a throw inside
 * `createRoutes` cannot leak it into another test file.
 */
function mountedRoutes(): Set<string> {
  const service = new Proxy({}, { get: () => () => Promise.resolve({}) }) as never;
  const passthrough = (_req: Request, _res: Response, next: () => void) => {
    next();
  };

  const container = {
    guards: {
      requireDealer: passthrough,
      requireSignedIn: passthrough,
      requireAdmin: passthrough,
    },
    rateLimit: () => passthrough,
    auth: service,
    publicConfig: service,
    locations: service,
    dealers: service,
    admin: service,
    media: service,
    storage: service,
    prisma: { $queryRaw: () => Promise.resolve([]) },
  } as unknown as Container;

  const prototype = (express as unknown as { Router: { prototype: Record<string, unknown> } })
    .Router.prototype;
  const originalUse = prototype.use as (...args: unknown[]) => unknown;
  const mountedAt = new Map<unknown, string>();

  prototype.use = function patched(this: unknown, ...args: unknown[]): unknown {
    const [first, ...rest] = args;
    if (typeof first === 'string') {
      for (const handler of rest) {
        // A child router, as opposed to a plain middleware function.
        if (typeof handler === 'function' && 'stack' in handler) {
          mountedAt.set(handler, first);
        }
      }
    }
    return originalUse.apply(this, args);
  };

  let routes: unknown;
  try {
    routes = createRoutes(container);
  } finally {
    prototype.use = originalUse;
  }

  const found = new Set<string>();
  walk(routes, '', mountedAt, found);
  return found;
}

interface Layer {
  route?: { path: string; stack: { method?: string }[] };
  handle?: unknown;
}

function walk(
  router: unknown,
  prefix: string,
  mountedAt: Map<unknown, string>,
  out: Set<string>,
): void {
  const stack = (router as { stack?: Layer[] }).stack ?? [];

  for (const layer of stack) {
    if (layer.route) {
      /**
       * A route declared at `/` inside a router mounted at `/v1/dealer` serves
       * `/v1/dealer` — Express matches it with and without the trailing slash,
       * and the reference documents the form without. Concatenating naively
       * yields `/v1/dealer/`, which matches no operation and would report a
       * documented route as undocumented *and* an existing route as orphaned:
       * one mistake, two failures, neither of them true.
       *
       * F041 is the first feature to mount a route at a router's root, which
       * is why this appears now rather than with the harness (F098).
       */
      const path = trimTrailingSlash(`${prefix}${layer.route.path}`);
      for (const entry of layer.route.stack) {
        if (entry.method) out.add(`${entry.method.toUpperCase()} ${path}`);
      }
      continue;
    }

    const handle = layer.handle;
    if (handle && typeof handle === 'function' && 'stack' in handle) {
      // `router.use(fn)` with no path contributes no prefix.
      const mount = mountedAt.get(handle) ?? '';
      walk(handle, `${prefix}${mount === '/' ? '' : mount}`, mountedAt, out);
    }
  }
}

/** `/v1/dealer/` → `/v1/dealer`, but `/` stays `/`. */
function trimTrailingSlash(path: string): string {
  return path.length > 1 && path.endsWith('/') ? path.slice(0, -1) : path;
}

/** `/v1/dealer/media/{id}` → `/v1/dealer/media/:id`, to compare like with like. */
function toExpressPath(openApiPath: string): string {
  return openApiPath.replace(/\{([A-Za-z0-9_]+)\}/g, ':$1');
}

function documentedRoutes(): Set<string> {
  const document = buildOpenApiDocument() as {
    paths: Record<string, Record<string, unknown>>;
  };

  const found = new Set<string>();
  for (const [path, operations] of Object.entries(document.paths)) {
    for (const method of Object.keys(operations)) {
      found.add(`${method.toUpperCase()} ${toExpressPath(path)}`);
    }
  }
  return found;
}

describe('the OpenAPI document against the router', () => {
  it('documents every mounted route', () => {
    const undocumented = [...mountedRoutes()].filter((route) => !documentedRoutes().has(route));

    expect(
      undocumented,
      'These routes are mounted but absent from the OpenAPI document. Add an operation to ' +
        "the module's `*.docs.ts` in the same PR that added the route — CLAUDE.md §4.",
    ).toEqual([]);
  });

  it('mounts every documented route', () => {
    const mounted = mountedRoutes();
    const orphaned = [...documentedRoutes()].filter((route) => !mounted.has(route));

    expect(
      orphaned,
      'These operations are documented but no route serves them. A reference that lists an ' +
        'endpoint which 404s is worse than one that omits it.',
    ).toEqual([]);
  });
});

describe('the document itself', () => {
  it('builds', () => {
    expect(() => buildOpenApiDocument()).not.toThrow();
  });

  it('names every tag it orders', () => {
    const document = buildOpenApiDocument() as { tags: { name: string; description: string }[] };

    for (const tag of document.tags) {
      expect(tag.description, `tag "${tag.name}" has no description`).toBeTruthy();
    }
  });

  /** The property the whole `schemas.ts` design exists to buy. */
  it('generates its schemas from contracts rather than by hand', () => {
    const document = buildOpenApiDocument() as {
      components: { schemas: Record<string, unknown> };
    };

    expect(document.components.schemas).toHaveProperty('AuthSession');
    expect(document.components.schemas).toHaveProperty('ProblemDetails');
    expect(document.components.schemas).toHaveProperty('MediaPresignInput');
  });
});
