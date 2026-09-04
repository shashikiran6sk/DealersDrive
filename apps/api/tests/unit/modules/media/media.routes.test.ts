import { describe, expect, it } from 'vitest';

import {
  createMediaRouter,
  createStorageRouter,
} from '../../../../src/modules/media/media.routes.js';
import {
  permissionsOn,
  routeFor,
  routesOf,
  signaturesOf,
  validatedSources,
} from '../../../router-probe.js';

/**
 * Photos, and the local stand-in for R2.
 *
 * The two routers mount at different points for a reason worth stating: the
 * media router is dealer surface behind `requireDealer`, while the storage
 * router is *not* API surface at all — it is what an S3 presigned PUT would be
 * in production, and it authenticates with the HMAC in its own query string
 * rather than with a session. Merging them would put an unauthenticated PUT
 * inside the console's guard chain.
 *
 * ── Reconstruction slice ────────────────────────────────────────────────────
 * `PUT /vehicles/:id/media/order` is **F035** and is not mounted, so its three
 * cases — the signature, the `vehicle:write` guard and the parsed body — go
 * with it. Every other assertion here is the baseline's, unchanged: the
 * storage router's whole block in particular, because that router is complete
 * as of this feature.
 * ────────────────────────────────────────────────────────────────────────────
 */

const media = createMediaRouter({} as never);
const storage = createStorageRouter({} as never, {} as never);

describe('the media router', () => {
  it('declares exactly the photo endpoints', () => {
    expect(signaturesOf(media).sort()).toEqual(
      [
        'POST /media/presign',
        'POST /media/:id/commit',
        'GET /media/:id',
        'DELETE /media/:id',
      ].sort(),
    );
  });

  /**
   * Photos are part of the car, so they follow the vehicle permissions rather
   * than getting their own. Reordering and deleting a photo change what the
   * public sees, which makes them writes.
   */
  it.each([
    ['GET /media/:id', 'vehicle:read'],
    ['POST /media/presign', 'vehicle:write'],
    ['POST /media/:id/commit', 'vehicle:write'],
    ['DELETE /media/:id', 'vehicle:write'],
  ])('guards %s with %s', (signature, permission) => {
    expect(permissionsOn(routeFor(media, signature) as never)).toEqual([permission]);
  });

  it('leaves no media route unguarded', () => {
    for (const route of routesOf(media)) {
      expect(permissionsOn(route), `${route.method} ${route.path}`).toHaveLength(1);
    }
  });

  it('guards every write with a write permission, never the read one', () => {
    for (const route of routesOf(media)) {
      if (route.method !== 'GET') {
        expect(permissionsOn(route), `${route.method} ${route.path}`).not.toContain('vehicle:read');
      }
    }
  });

  /** The presign body declares the type and size that will be signed for. */
  it('parses the presign body', () => {
    expect(validatedSources(routeFor(media, 'POST /media/presign') as never)).toContain('body');
  });

  /*
   * ── Reconstruction slice ────────────────────────────────────────────────
   * `it('parses the reorder body')` returns with F035's route.
   */

  it('parses the id on every route that takes one', () => {
    for (const route of routesOf(media)) {
      if (route.path.includes(':id')) {
        expect(validatedSources(route), `${route.method} ${route.path}`).toContain('params');
      }
    }
  });
});

describe('the storage router', () => {
  it('declares the presigned PUT and the derivative read', () => {
    expect(signaturesOf(storage).sort()).toEqual(
      ['PUT /uploads', 'GET /media/vehicles/by-media/:mediaId/:width.webp'].sort(),
    );
  });

  /**
   * No session, no permission — by design. This route stands in for an S3
   * presigned PUT, and its authority comes from the HMAC over key, type,
   * length and expiry that `POST /media/presign` produced.
   */
  it('asks for no permission, because it is not API surface', () => {
    for (const route of routesOf(storage)) {
      expect(permissionsOn(route), `${route.method} ${route.path}`).toEqual([]);
    }
  });

  it('parses the signed query rather than reading it raw', () => {
    expect(validatedSources(routeFor(storage, 'PUT /uploads') as never)).toContain('query');
  });

  /** Outside `/v1`: storage is not versioned API surface. */
  it('mounts outside the versioned prefix', () => {
    for (const { path } of routesOf(storage)) {
      expect(path, path).not.toContain('/v1');
    }
  });
});
