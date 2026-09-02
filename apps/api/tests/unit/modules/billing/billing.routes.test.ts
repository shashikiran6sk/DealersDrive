import { describe, expect, it } from 'vitest';

import { createBillingRouter } from '../../../../src/modules/billing/billing.routes.js';
import {
  permissionsOn,
  routeFor,
  routesOf,
  signaturesOf,
  validatedSources,
} from '../../../router-probe.js';

/**
 * Credits and money, mounted under `/v1/dealer`.
 *
 * One distinction carries this whole router: **`billing:read` is not
 * `billing:purchase`.** A manager may look at the balance, the ledger and the
 * invoices; only the OWNER may spend. Guarding a purchase route with the read
 * permission would let any manager charge the dealership's card, and that is
 * exactly the kind of mistake a route file makes silently.
 */

const router = createBillingRouter({} as never, {} as never, () => (_req, _res, next) => {
  next();
});

describe('the surface', () => {
  it('declares exactly the billing endpoints', () => {
    expect(signaturesOf(router).sort()).toEqual(
      [
        'GET /billing/summary',
        'GET /billing/packs',
        'POST /billing/orders',
        'POST /billing/orders/:id/verify',
        'GET /billing/ledger',
        'GET /billing/invoices',
        'GET /billing/invoices/:id/pdf',
      ].sort(),
    );
  });

  /** CLAUDE.md: there is no Razorpay page, and no gateway callback route. */
  it('exposes no gateway callback', () => {
    for (const { path } of routesOf(router)) {
      expect(path.toLowerCase(), path).not.toMatch(/razorpay|webhook|callback/);
    }
  });
});

describe('permissions', () => {
  it.each([
    'GET /billing/summary',
    'GET /billing/packs',
    'GET /billing/ledger',
    'GET /billing/invoices',
    'GET /billing/invoices/:id/pdf',
  ])('lets a manager read %s', (signature) => {
    expect(permissionsOn(routeFor(router, signature) as never)).toEqual(['billing:read']);
  });

  /** Spending is the owner's alone (§8.3). */
  it.each(['POST /billing/orders', 'POST /billing/orders/:id/verify'])(
    'reserves %s to billing:purchase',
    (signature) => {
      expect(permissionsOn(routeFor(router, signature) as never)).toEqual(['billing:purchase']);
    },
  );

  it('leaves no billing route unguarded', () => {
    for (const route of routesOf(router)) {
      expect(permissionsOn(route), `${route.method} ${route.path}`).toHaveLength(1);
    }
  });

  it('never guards a write with the read permission', () => {
    for (const route of routesOf(router)) {
      if (route.method !== 'GET') {
        expect(permissionsOn(route), `${route.method} ${route.path}`).not.toContain('billing:read');
      }
    }
  });
});

describe('validation', () => {
  /**
   * §26.4: the order body carries a `packId` and nothing else — no amount, no
   * credit count. A client-supplied amount is how a marketplace gives its
   * inventory away, so the body must be parsed rather than read raw.
   */
  it('parses the order body rather than trusting it', () => {
    expect(validatedSources(routeFor(router, 'POST /billing/orders') as never)).toContain('body');
  });

  it('parses the paging query on the ledger and the invoice list', () => {
    for (const signature of ['GET /billing/ledger', 'GET /billing/invoices']) {
      expect(validatedSources(routeFor(router, signature) as never)).toContain('query');
    }
  });

  it('parses the id on every route that takes one', () => {
    for (const route of routesOf(router)) {
      if (route.path.includes(':id')) {
        expect(validatedSources(route), `${route.method} ${route.path}`).toContain('params');
      }
    }
  });
});
