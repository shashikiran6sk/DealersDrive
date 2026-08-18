import { describe, expect, it } from 'vitest';

import { createVehiclesRouter } from '../../../../src/modules/vehicles/vehicles.routes.js';
import {
  permissionsOn,
  requiresActiveDealer,
  routeFor,
  routesOf,
  signaturesOf,
  validatedSources,
} from '../../../router-probe.js';

/**
 * C6–C13, mounted under `/v1/dealer` behind `requireDealer`.
 *
 * The integration suite proves these endpoints work. What it cannot prove
 * cheaply is the negative: that no route is *missing* its guard. A handler
 * that reads `dealerPrincipal(req)` perfectly is still a leak if
 * `requirePermission` was left off the chain — and that omission looks like
 * nothing in a diff. So this file reads the wiring rather than the responses.
 */

const router = createVehiclesRouter({} as never);

describe('the surface', () => {
  it('declares exactly the inventory endpoints, and no more', () => {
    expect(signaturesOf(router).sort()).toEqual(
      [
        'GET /vehicles',
        'POST /vehicles',
        'GET /vehicles/:id',
        'PATCH /vehicles/:id',
        'DELETE /vehicles/:id',
        'POST /vehicles/:id/submit',
        'POST /vehicles/:id/mark-sold',
        'POST /listings/:id/renew',
      ].sort(),
    );
  });

  it('declares no route twice', () => {
    const signatures = signaturesOf(router);

    expect(new Set(signatures).size).toBe(signatures.length);
  });
});

describe('permissions', () => {
  /**
   * The §8.3 matrix as this router applies it. A read permission on a write
   * route is the escalation worth catching: SALES holds `vehicle:read`, so a
   * PATCH guarded by it would let a salesperson rewrite a price.
   */
  it.each([
    ['GET /vehicles', 'vehicle:read'],
    ['GET /vehicles/:id', 'vehicle:read'],
    ['POST /vehicles', 'vehicle:write'],
    ['PATCH /vehicles/:id', 'vehicle:write'],
    ['POST /vehicles/:id/mark-sold', 'vehicle:write'],
    ['DELETE /vehicles/:id', 'vehicle:delete'],
    ['POST /vehicles/:id/submit', 'listing:submit'],
    ['POST /listings/:id/renew', 'listing:renew'],
  ])('guards %s with %s', (signature, permission) => {
    expect(permissionsOn(routeFor(router, signature) as never)).toEqual([permission]);
  });

  it('leaves no route unguarded', () => {
    for (const route of routesOf(router)) {
      expect(permissionsOn(route), `${route.method} ${route.path}`).not.toEqual([]);
    }
  });

  it('asks for exactly one permission per route', () => {
    for (const route of routesOf(router)) {
      expect(permissionsOn(route), `${route.method} ${route.path}`).toHaveLength(1);
    }
  });
});

describe('the active-dealer gate', () => {
  /**
   * API-SPEC C11: a dealer who is not yet approved can read their console —
   * they need to see why — but cannot put a car in front of the public. Only
   * the two publishing routes carry the gate.
   */
  it.each(['POST /vehicles/:id/submit', 'POST /listings/:id/renew'])(
    'refuses %s from a dealership that is not ACTIVE',
    (signature) => {
      expect(requiresActiveDealer(routeFor(router, signature) as never)).toBe(true);
    },
  );

  it.each([
    'GET /vehicles',
    'GET /vehicles/:id',
    'POST /vehicles',
    'PATCH /vehicles/:id',
    'DELETE /vehicles/:id',
    'POST /vehicles/:id/mark-sold',
  ])('lets a pending dealership still use %s', (signature) => {
    expect(requiresActiveDealer(routeFor(router, signature) as never)).toBe(false);
  });
});

describe('validation', () => {
  it('parses the id on every route that takes one', () => {
    for (const route of routesOf(router)) {
      if (route.path.includes(':id')) {
        expect(validatedSources(route), `${route.method} ${route.path}`).toContain('params');
      }
    }
  });

  it('parses the body on every route that takes one', () => {
    for (const signature of ['POST /vehicles', 'PATCH /vehicles/:id']) {
      expect(validatedSources(routeFor(router, signature) as never)).toContain('body');
    }
  });

  /** §9.2: an unknown query parameter is a 400, never a silent ignore. */
  it('parses the inventory query rather than reading req.query raw', () => {
    expect(validatedSources(routeFor(router, 'GET /vehicles') as never)).toContain('query');
  });
});

describe('what the router must not accept', () => {
  /**
   * Rule 1, checked mechanically: no route declares a `dealerId` path
   * parameter, because the tenant comes from the session and from nowhere
   * else. A `/vehicles/:dealerId/...` route would be a tenant-isolation bug
   * before a single handler ran.
   */
  it('declares no dealer id in any path', () => {
    for (const { path } of routesOf(router)) {
      expect(path.toLowerCase(), path).not.toContain('dealerid');
    }
  });
});
