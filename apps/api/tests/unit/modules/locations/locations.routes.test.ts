import { describe, expect, it } from 'vitest';

import { createLocationsRouter } from '../../../../src/modules/locations/locations.routes.js';
import { permissionsOn, routesOf, signaturesOf } from '../../../router-probe.js';

/**
 * Unit tests for `src/modules/locations/locations.routes.ts`.
 *
 * ── Adapted from `tests/unit/modules/catalog/catalog.routes.test.ts` ────────
 * The baseline asserts four signatures on one router. Two are the catalogue
 * routes decision D1 removes, one is `GET /config/public` (**F029**), and this
 * is the fourth.
 * ────────────────────────────────────────────────────────────────────────────
 *
 * The city list is the same for every caller, which is what makes it cacheable
 * and what makes it public.
 */
const router = createLocationsRouter({} as never);

describe('the surface', () => {
  it('declares exactly the one city endpoint', () => {
    expect(signaturesOf(router)).toEqual(['GET /cities']);
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
   * `/cities` is public reference data; `/dealer/*` is the console. One
   * character separates `/v1/dealers` from `/v1/dealer` elsewhere in the mount
   * table, and the same care applies here: this router must claim exactly one
   * path and not a prefix.
   */
  it('takes no path parameter', () => {
    for (const route of routesOf(router)) {
      expect(route.path, route.path).not.toContain(':');
    }
  });
});
