import { describe, expect, it } from 'vitest';

import {
  createDealerEnquiriesRouter,
  createPublicEnquiriesRouter,
} from '../../../../src/modules/enquiries/enquiries.routes.js';
import {
  permissionsOn,
  routeFor,
  routesOf,
  signaturesOf,
  validatedSources,
} from '../../../router-probe.js';

/**
 * Leads, from both sides. The two routers are deliberately separate objects
 * because they mount at different points with different guard chains: the
 * public one takes a form from an anonymous buyer, the dealer one is behind
 * `requireDealer`. Merging them would put an unauthenticated POST one
 * `router.use` away from the console.
 */

const publicRouter = createPublicEnquiriesRouter({} as never);
const dealerRouter = createDealerEnquiriesRouter({} as never);

describe('the public router', () => {
  it('declares only the two endpoints a buyer can reach', () => {
    expect(signaturesOf(publicRouter).sort()).toEqual(
      ['POST /enquiries', 'POST /vehicles/:id/reveal-contact'].sort(),
    );
  });

  /** There is no principal here at all — a permission check would 401 every buyer. */
  it('asks for no permission', () => {
    for (const route of routesOf(publicRouter)) {
      expect(permissionsOn(route), `${route.method} ${route.path}`).toEqual([]);
    }
  });

  it('parses the enquiry body rather than reading it raw', () => {
    expect(validatedSources(routeFor(publicRouter, 'POST /enquiries') as never)).toContain('body');
  });

  it('parses the vehicle id on the reveal', () => {
    expect(
      validatedSources(routeFor(publicRouter, 'POST /vehicles/:id/reveal-contact') as never),
    ).toContain('params');
  });

  /**
   * The reveal is a POST, not a GET. A phone number that came back from a GET
   * would be cached by every proxy between here and the buyer, which defeats
   * both the rate limit and the reveal count.
   */
  it('reveals a number through POST, so nothing caches it', () => {
    expect(routesOf(publicRouter).find((route) => route.path.includes('reveal'))?.method).toBe(
      'POST',
    );
  });

  it('exposes no route that reads a lead back', () => {
    for (const route of routesOf(publicRouter)) {
      expect(route.method, `${route.method} ${route.path}`).not.toBe('GET');
    }
  });
});

describe('the dealer router', () => {
  it('declares exactly the console endpoints', () => {
    expect(signaturesOf(dealerRouter).sort()).toEqual(
      ['GET /enquiries', 'GET /enquiries/counts', 'PATCH /enquiries/:id'].sort(),
    );
  });

  /** Every seat works leads, including SALES — that is what a salesperson is for. */
  it.each([
    ['GET /enquiries', 'enquiry:read'],
    ['GET /enquiries/counts', 'enquiry:read'],
    ['PATCH /enquiries/:id', 'enquiry:update'],
  ])('guards %s with %s', (signature, permission) => {
    expect(permissionsOn(routeFor(dealerRouter, signature) as never)).toEqual([permission]);
  });

  it('leaves no route unguarded', () => {
    for (const route of routesOf(dealerRouter)) {
      expect(permissionsOn(route), `${route.method} ${route.path}`).toHaveLength(1);
    }
  });

  it('never guards the write with the read permission', () => {
    expect(permissionsOn(routeFor(dealerRouter, 'PATCH /enquiries/:id') as never)).not.toContain(
      'enquiry:read',
    );
  });

  it('parses the list query and the update body', () => {
    expect(validatedSources(routeFor(dealerRouter, 'GET /enquiries') as never)).toContain('query');
    expect(validatedSources(routeFor(dealerRouter, 'PATCH /enquiries/:id') as never)).toContain(
      'body',
    );
  });

  /** Rule 1: a lead belongs to the session's dealership, never to a path parameter. */
  it('declares no dealer id in any path', () => {
    for (const { path } of routesOf(dealerRouter)) {
      expect(path.toLowerCase(), path).not.toContain('dealerid');
    }
  });
});
