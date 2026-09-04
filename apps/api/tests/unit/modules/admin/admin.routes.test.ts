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
 * function that performs it. Putting the check there rather than here means it
 * cannot be bypassed by a second caller reaching the service another way, and
 * it keeps the permission next to the audit row it justifies.
 *
 * So what this file checks is the surface: which endpoints exist, and that
 * nothing here answers a route it should not.
 *
 * ── Reconstruction slice ────────────────────────────────────────────────────
 * The baseline asserts twenty signatures. **F044 brings the count to three**;
 * F045 brings the dealer paths, and the listing queue, payments, configuration
 * and audit log belong to later tiers.
 * ────────────────────────────────────────────────────────────────────────────
 */
const router = createAdminRouter({} as never);

describe('the surface', () => {
  it('declares exactly the console endpoints that exist yet', () => {
    expect(signaturesOf(router).sort()).toEqual(
      ['GET /metrics/overview', 'POST /documents/:id/verify', 'POST /documents/:id/reject'].sort(),
    );
  });

  it('declares no route twice', () => {
    const signatures = signaturesOf(router);

    expect(new Set(signatures).size).toBe(signatures.length);
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
      if (route.path.includes(':id')) {
        expect(validatedSources(route), `${route.method} ${route.path}`).toContain('params');
      }
    }
  });

  /**
   * A rejection the dealer cannot act on is a support call. The six-character
   * minimum is in `ReasonInput`, and this is what makes sure the route reaches
   * it rather than accepting an empty body.
   */
  it('parses the reason a rejection must carry', () => {
    expect(validatedSources(routeFor(router, 'POST /documents/:id/reject') as never)).toContain(
      'body',
    );
  });

  /** Verifying needs no reason — there is nothing for the dealer to act on. */
  it('asks for no body on the verify path', () => {
    expect(validatedSources(routeFor(router, 'POST /documents/:id/verify') as never)).not.toContain(
      'body',
    );
  });
});

describe('what the router must not accept', () => {
  /**
   * The admin console is the one place that reads across tenants, so it
   * addresses a dealership by id — the opposite of the dealer router, where a
   * `dealerId` in a path would be the bug.
   */
  it('never resolves its tenant from a query string', () => {
    for (const { path } of routesOf(router)) {
      expect(path, path).not.toContain('?');
    }
  });
});
