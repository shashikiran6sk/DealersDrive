import { describe, expect, it } from 'vitest';

import { createDealersRouter } from '../../../../src/modules/dealers/dealers.routes.js';
import { permissionsOn, routeFor, routesOf, signaturesOf } from '../../../router-probe.js';

/**
 * The dealer's own account, mounted under `/v1/dealer` behind `requireDealer`.
 *
 * The line this router draws is between *reading* your dealership and
 * *changing* it. Reads are open to any seat that got through the guard —
 * a salesperson can see the dashboard. Writes are OWNER-only, because the
 * profile and the KYC documents are the dealership's identity: `dealer:update`
 * and `document:upload` appear in §8.3 against OWNER alone.
 *
 * ── Reconstruction slice ────────────────────────────────────────────────────
 * The baseline asserts nine signatures. **F040 mounts one**, so the surface
 * assertion names one; it grows with F041, F042, F043 and F048. The
 * permission blocks are the reason this file exists at all, and the half that
 * is reachable — a read carrying no permission — is asserted in the general
 * form ("every write is guarded, and only the writes") so it keeps holding as
 * the writes arrive.
 * ────────────────────────────────────────────────────────────────────────────
 */
const router = createDealersRouter({} as never);

describe('the surface', () => {
  it('declares exactly the account endpoints that exist yet', () => {
    expect(signaturesOf(router).sort()).toEqual(['GET /documents']);
  });

  it('declares no route twice', () => {
    const signatures = signaturesOf(router);

    expect(new Set(signatures).size).toBe(signatures.length);
  });
});

describe('permissions', () => {
  /**
   * This carries no permission on purpose: `requireDealer` already ran, and a
   * salesperson who cannot see their own KYC checklist has a broken console.
   * The tenant scope still comes from the principal, so nothing here is
   * unscoped.
   */
  it('leaves GET /documents open to any authenticated seat', () => {
    expect(permissionsOn(routeFor(router, 'GET /documents') as never)).toEqual([]);
  });

  it('guards every write, and only the writes', () => {
    for (const route of routesOf(router)) {
      const guarded = permissionsOn(route).length > 0;
      expect(guarded, `${route.method} ${route.path}`).toBe(route.method !== 'GET');
    }
  });
});

describe('what the router must not accept', () => {
  /** Rule 1: the tenant is the session's, so no path may name one. */
  it('declares no dealer id in any path', () => {
    for (const { path } of routesOf(router)) {
      expect(path.toLowerCase(), path).not.toContain('dealerid');
    }
  });
});
