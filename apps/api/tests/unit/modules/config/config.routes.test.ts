import { describe, expect, it } from 'vitest';

import { createConfigRouter } from '../../../../src/modules/config/config.routes.js';
import { permissionsOn, routesOf, signaturesOf } from '../../../router-probe.js';

/**
 * Unit tests for `src/modules/config/config.routes.ts`.
 *
 * ── Adapted from `tests/unit/modules/catalog/catalog.routes.test.ts` ────────
 * The baseline asserts four signatures on one router: two catalogue routes
 * decision D1 removes, `GET /cities` (**F026**), and this one. What survives is
 * the half that was never about the catalogue.
 * ────────────────────────────────────────────────────────────────────────────
 *
 * The payload is the same for every caller, which is what makes it cacheable
 * and what makes it public.
 */
const router = createConfigRouter({} as never);

describe('the surface', () => {
  it('declares exactly the one public config endpoint', () => {
    expect(signaturesOf(router)).toEqual(['GET /config/public']);
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

  /** Fixed document, no parameters — the whole reason it can be edge-cached. */
  it('takes no path parameter', () => {
    for (const route of routesOf(router)) {
      expect(route.path, route.path).not.toContain(':');
    }
  });
});
