import { describe, expect, it } from 'vitest';

import { createVehicleImagesRouter } from '../../../../src/modules/vehicle-images/vehicle-images.routes.js';
import { vehicleImageKey } from '../../../../src/modules/vehicle-images/vehicle-images.service.js';
import { permissionsOn, routesOf, signaturesOf, validatedSources } from '../../../router-probe.js';

describe('the router', () => {
  const router = createVehicleImagesRouter({} as never);

  it('declares the upload and removal, in order', () => {
    expect(signaturesOf(router)).toEqual([
      'POST /listings/:id/images/presign',
      'POST /listings/:id/images/:mediaId/commit',
      'PUT /listings/:id/images/order',
      'PUT /listings/:id/images/:mediaId/primary',
      'DELETE /listings/:id/images/:mediaId',
    ]);
  });

  it('guards every route with admin:media:upload', () => {
    for (const route of routesOf(router)) {
      expect(permissionsOn(route), `${route.method} ${route.path}`).toEqual(['admin:media:upload']);
    }
  });

  it('parses the params on every route, and the body at presign and reorder', () => {
    for (const route of routesOf(router)) {
      expect(validatedSources(route), `${route.method} ${route.path}`).toContain('params');
    }
    const [presign, , order] = routesOf(router);
    expect(validatedSources(presign!)).toContain('body');
    expect(validatedSources(order!)).toContain('body');
  });
});

describe('vehicleImageKey', () => {
  it('derives the key from the vehicle and the media id, never from the client', () => {
    expect(vehicleImageKey('v-1', 'm-1', 'image/jpeg')).toBe('vehicles/v-1/m-1/original.jpg');
    expect(vehicleImageKey('v-1', 'm-1', 'image/png')).toBe('vehicles/v-1/m-1/original.png');
    expect(vehicleImageKey('v-1', 'm-1', 'image/webp')).toBe('vehicles/v-1/m-1/original.webp');
  });
});
