import { describe, expect, it } from 'vitest';

import { createCatalogRouter } from '../../../../src/modules/catalog/catalog.routes.js';
import { permissionsOn, routesOf, signaturesOf } from '../../../router-probe.js';

/**
 * Reference data — makes, models, cities, and the public half of the platform
 * config. Everything here is the same for every caller, which is what makes it
 * cacheable and what makes it public.
 */

const router = createCatalogRouter({} as never);

describe('the surface', () => {
  it('declares exactly the reference endpoints', () => {
    expect(signaturesOf(router).sort()).toEqual(
      ['GET /catalog/bundle', 'GET /cities', 'GET /config/public'].sort(),
    );
  });

  it('is read-only', () => {
    for (const route of routesOf(router)) {
      expect(route.method, `${route.method} ${route.path}`).toBe('GET');
    }
  });

  it('asks for no permission', () => {
    for (const route of routesOf(router)) {
      expect(permissionsOn(route), `${route.method} ${route.path}`).toEqual([]);
    }
  });

  /**
   * The name is load-bearing: `/config/public` serves the half of the platform
   * config a browser may see. A route named `/config` would be one rename away
   * from serving the moderation thresholds and pack margins with it.
   */
  it('names the public config route for what it exposes', () => {
    expect(signaturesOf(router)).toContain('GET /config/public');
    expect(signaturesOf(router)).not.toContain('GET /config');
  });

  it('takes no path parameters — this is a fixed set of documents', () => {
    for (const { path } of routesOf(router)) {
      expect(path, path).not.toContain(':');
    }
  });
});
