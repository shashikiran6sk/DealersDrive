import { describe, expect, it } from 'vitest';

import { createSearchRouter } from '../../../../src/modules/search/search.routes.js';
import {
  permissionsOn,
  routeFor,
  routesOf,
  signaturesOf,
  validatedSources,
} from '../../../router-probe.js';

/**
 * The public catalogue. No principal ever reaches these handlers, so the
 * safety property is not "who may" but "what is visible" — and that is decided
 * upstream, by `listing_search` containing only APPROVED listings of ACTIVE
 * dealers. What this file checks is that the router stays public, stays
 * read-only, and parses everything a caller sends.
 */

const router = createSearchRouter({} as never, {} as never, () => (_req, _res, next) => {
  next();
});

describe('the surface', () => {
  it('declares exactly the public catalogue endpoints', () => {
    expect(signaturesOf(router).sort()).toEqual(
      [
        'GET /home',
        'GET /vehicles',
        'GET /vehicles/facets',
        'POST /vehicles/batch',
        'GET /vehicles/:idOrSlug',
        'GET /vehicles/:id/similar',
        'GET /dealers',
        'GET /dealers/:slug',
        'GET /dealers/:slug/vehicles',
        'GET /dealers/:slug/facets',
      ].sort(),
    );
  });

  it('asks for no permission anywhere — this is the anonymous surface', () => {
    for (const route of routesOf(router)) {
      expect(permissionsOn(route), `${route.method} ${route.path}`).toEqual([]);
    }
  });

  /**
   * The one POST reads saved cars in bulk. A GET with 40 ids would exceed a
   * URL length limit, so it is a POST that writes nothing.
   */
  it('is read-only apart from the batch read', () => {
    for (const route of routesOf(router)) {
      if (route.method !== 'GET') {
        expect(`${route.method} ${route.path}`).toBe('POST /vehicles/batch');
      }
    }
  });

  it('declares the specific routes before the catch-all slug route', () => {
    const signatures = signaturesOf(router);

    expect(signatures.indexOf('GET /vehicles/facets')).toBeLessThan(
      signatures.indexOf('GET /vehicles/:idOrSlug'),
    );
  });
});

describe('validation', () => {
  /**
   * §9.2: `.strict()` on the query is why `?lmit=5` is a 400 rather than a
   * silently ignored typo — and it only fires because the query is parsed
   * rather than read off `req.query`.
   */
  it.each(['GET /home', 'GET /vehicles', 'GET /vehicles/facets', 'GET /dealers'])(
    'parses the query on %s',
    (signature) => {
      expect(validatedSources(routeFor(router, signature) as never)).toContain('query');
    },
  );

  it('parses the batch body', () => {
    expect(validatedSources(routeFor(router, 'POST /vehicles/batch') as never)).toContain('body');
  });

  it('parses the path parameter on every addressed route', () => {
    for (const route of routesOf(router)) {
      if (/:\w/.test(route.path)) {
        expect(validatedSources(route), `${route.method} ${route.path}`).toContain('params');
      }
    }
  });
});

describe('what the public surface must not offer', () => {
  /** A public route that took a dealer id would be a tenant filter a caller controls. */
  it('addresses a dealership by slug, never by id', () => {
    for (const { path } of routesOf(router)) {
      expect(path.toLowerCase(), path).not.toContain('dealerid');
    }
  });

  it('exposes no reveal, enquiry or admin path', () => {
    for (const { path } of routesOf(router)) {
      expect(path, path).not.toMatch(/reveal|enquir|admin/i);
    }
  });
});
