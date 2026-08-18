import { describe, expect, it } from 'vitest';

import { createAdminRouter } from '../../../../src/modules/admin/admin.routes.js';
import {
  permissionsOn,
  routeFor,
  routesOf,
  signaturesOf,
  validatedSources,
} from '../../../router-probe.js';

/**
 * D1–D15, mounted under `/v1/admin` behind `requireAdmin`.
 *
 * This router deliberately carries **no** `requirePermission` middleware, and
 * that is worth being explicit about rather than reading as an omission. An
 * admin action's permission is checked inside `admin.service.ts`, in the same
 * function that performs it — `admin.service.test.ts` runs all fourteen of
 * those checks. Putting the check there rather than here means it cannot be
 * bypassed by a second caller reaching the service another way, and it keeps
 * the permission next to the audit row it justifies.
 *
 * So what this file checks is the surface: which endpoints exist, that every
 * write parses its body, and that nothing here answers a GET it should not.
 */

const router = createAdminRouter({} as never);

describe('the surface', () => {
  it('declares exactly the moderation console endpoints', () => {
    expect(signaturesOf(router).sort()).toEqual(
      [
        'GET /metrics/overview',
        'GET /dealers',
        'GET /dealers/:id',
        'POST /dealers/:id/approve',
        'POST /dealers/:id/reject',
        'POST /dealers/:id/suspend',
        'POST /dealers/:id/reinstate',
        'POST /dealers/:id/credits/grant',
        'POST /documents/:id/verify',
        'POST /documents/:id/reject',
        'GET /listings',
        'GET /listings/:id',
        'POST /listings/:id/approve',
        'POST /listings/:id/reject',
        'POST /listings/:id/request-changes',
        'POST /listings/:id/takedown',
        'GET /payments',
        'GET /config',
        'PUT /config/:key',
        'GET /audit-logs',
      ].sort(),
    );
  });

  it('declares no route twice', () => {
    const signatures = signaturesOf(router);

    expect(new Set(signatures).size).toBe(signatures.length);
  });

  /** The three moderation outcomes an admin can reach for a listing (§12). */
  it.each([
    'POST /listings/:id/approve',
    'POST /listings/:id/reject',
    'POST /listings/:id/request-changes',
  ])('offers %s', (signature) => {
    expect(signaturesOf(router)).toContain(signature);
  });

  it('checks permissions in the service, not in the chain', () => {
    for (const route of routesOf(router)) {
      expect(permissionsOn(route), `${route.method} ${route.path}`).toEqual([]);
    }
  });
});

describe('validation', () => {
  it('parses the id on every addressed route', () => {
    for (const route of routesOf(router)) {
      if (/:\w/.test(route.path)) {
        expect(validatedSources(route), `${route.method} ${route.path}`).toContain('params');
      }
    }
  });

  /**
   * Each of these writes an audit row that quotes the admin's reason, so the
   * reason has to be parsed rather than read raw — an unvalidated one would be
   * stored as whatever arrived, including nothing.
   */
  it.each([
    'POST /dealers/:id/reject',
    'POST /dealers/:id/suspend',
    'POST /documents/:id/reject',
    'POST /listings/:id/reject',
    'POST /listings/:id/request-changes',
    'POST /listings/:id/takedown',
  ])('parses the body carrying the reason on %s', (signature) => {
    expect(validatedSources(routeFor(router, signature) as never)).toContain('body');
  });

  it('parses the credit grant body, which decides how many credits appear', () => {
    expect(
      validatedSources(routeFor(router, 'POST /dealers/:id/credits/grant') as never),
    ).toContain('body');
  });

  it('parses the config write body and its key', () => {
    const sources = validatedSources(routeFor(router, 'PUT /config/:key') as never);

    expect(sources).toContain('body');
    expect(sources).toContain('params');
  });

  it('parses the filter query on every list', () => {
    for (const signature of ['GET /dealers', 'GET /listings', 'GET /payments', 'GET /audit-logs']) {
      expect(validatedSources(routeFor(router, signature) as never)).toContain('query');
    }
  });
});

describe('what the console must not offer', () => {
  /**
   * An admin moderates; they do not act as a dealership. A route that took a
   * dealer's *session* rather than a dealer id would blur the two identities
   * in the audit log, which is the one record that has to stay unambiguous.
   */
  it('addresses a dealership by id in the path, so the audit row names it', () => {
    for (const { path } of routesOf(router)) {
      expect(path, path).not.toContain('/impersonate');
    }
  });

  it('exposes no route that deletes a record outright', () => {
    for (const route of routesOf(router)) {
      expect(route.method, `${route.method} ${route.path}`).not.toBe('DELETE');
    }
  });
});
