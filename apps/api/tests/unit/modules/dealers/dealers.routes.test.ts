import { describe, expect, it } from 'vitest';

import { createDealersRouter } from '../../../../src/modules/dealers/dealers.routes.js';
import {
  permissionsOn,
  routeFor,
  routesOf,
  signaturesOf,
  validatedSources,
} from '../../../router-probe.js';

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
 * The baseline asserts nine signatures. **F042 brings the count to eight**;
 * `GET /dashboard` arrives with F048 and closes the file.
 * ────────────────────────────────────────────────────────────────────────────
 */
const router = createDealersRouter({} as never);

describe('the surface', () => {
  it('declares exactly the account endpoints that exist yet', () => {
    expect(signaturesOf(router).sort()).toEqual(
      [
        'GET /',
        'PATCH /',
        'GET /completeness',
        'POST /submit',
        'GET /documents',
        'POST /documents/presign',
        'POST /documents/:type/commit',
        'DELETE /documents/:type',
      ].sort(),
    );
  });

  it('declares no route twice', () => {
    const signatures = signaturesOf(router);

    expect(new Set(signatures).size).toBe(signatures.length);
  });
});

describe('permissions', () => {
  /** Identity and KYC are the owner's alone. */
  it.each([
    ['PATCH /', 'dealer:update'],
    ['POST /submit', 'dealer:update'],
    ['POST /documents/presign', 'document:upload'],
    ['POST /documents/:type/commit', 'document:upload'],
    ['DELETE /documents/:type', 'document:upload'],
  ])('guards %s with %s, which only OWNER holds', (signature, permission) => {
    expect(permissionsOn(routeFor(router, signature) as never)).toEqual([permission]);
  });

  /**
   * These carry no permission on purpose: `requireDealer` already ran, and a
   * salesperson who cannot see their own dealership has a broken console. The
   * tenant scope still comes from the principal, so nothing here is unscoped.
   */
  it.each(['GET /', 'GET /completeness', 'GET /documents'])(
    'leaves %s open to any authenticated seat',
    (signature) => {
      expect(permissionsOn(routeFor(router, signature) as never)).toEqual([]);
    },
  );

  it('guards every write, and only the writes', () => {
    for (const route of routesOf(router)) {
      const guarded = permissionsOn(route).length > 0;
      expect(guarded, `${route.method} ${route.path}`).toBe(route.method !== 'GET');
    }
  });
});

describe('validation', () => {
  it('parses the profile patch body', () => {
    expect(validatedSources(routeFor(router, 'PATCH /') as never)).toContain('body');
  });

  it('parses the document type on every route that names one', () => {
    for (const route of routesOf(router)) {
      if (route.path.includes(':type')) {
        expect(validatedSources(route), `${route.method} ${route.path}`).toContain('params');
      }
    }
  });

  it('parses the presign body, which decides what may be uploaded', () => {
    expect(validatedSources(routeFor(router, 'POST /documents/presign') as never)).toContain(
      'body',
    );
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
