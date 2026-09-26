import { describe, expect, it } from 'vitest';

import { createVehiclesRouter } from '../../../../src/modules/vehicles/vehicles.routes.js';
import {
  permissionsOn,
  routeFor,
  routesOf,
  signaturesOf,
  validatedSources,
} from '../../../router-probe.js';

const router = createVehiclesRouter({} as never);

describe('the surface', () => {
  it('declares the dealer vehicle endpoints', () => {
    expect(signaturesOf(router)).toEqual([
      'POST /vehicles',
      'GET /vehicles/suggestions',
      'GET /vehicles/:id',
      'PATCH /vehicles/:id',
      'DELETE /vehicles/:id',
      'POST /vehicles/:id/submit',
    ]);
  });

  it('mounts the suggestions route before /:id would swallow it', () => {
    const paths = signaturesOf(router);
    expect(paths.indexOf('GET /vehicles/suggestions')).toBeLessThan(
      paths.indexOf('GET /vehicles/:id'),
    );
  });
});

describe('permissions', () => {
  it.each([
    ['POST /vehicles', 'vehicle:write'],
    ['GET /vehicles/suggestions', 'vehicle:read'],
    ['GET /vehicles/:id', 'vehicle:read'],
    ['PATCH /vehicles/:id', 'vehicle:write'],
    ['DELETE /vehicles/:id', 'vehicle:delete'],
    ['POST /vehicles/:id/submit', 'listing:submit'],
  ])('guards %s with %s', (signature, permission) => {
    expect(permissionsOn(routeFor(router, signature) as never)).toEqual([permission]);
  });
});

describe('validation', () => {
  it('parses the id on every route that names one', () => {
    for (const route of routesOf(router)) {
      if (route.path.includes(':id')) {
        expect(validatedSources(route), `${route.method} ${route.path}`).toContain('params');
      }
    }
  });

  it.each(['POST /vehicles', 'PATCH /vehicles/:id'])('parses the body of %s', (signature) => {
    expect(validatedSources(routeFor(router, signature) as never)).toContain('body');
  });

  it('parses the suggestion query', () => {
    expect(validatedSources(routeFor(router, 'GET /vehicles/suggestions') as never)).toContain(
      'query',
    );
  });

  it('declares no dealer id in any path', () => {
    for (const { path } of routesOf(router)) {
      expect(path.toLowerCase()).not.toContain('dealerid');
    }
  });
});
