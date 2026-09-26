import { describe, expect, it } from 'vitest';

import { createStorageRouter } from '../../../../src/modules/media/media.routes.js';
import {
  permissionsOn,
  routeFor,
  routesOf,
  signaturesOf,
  validatedSources,
} from '../../../router-probe.js';

/**
 * The local stand-in for R2.
 *
 * R45 withdrew the dealer's media router (`/v1/dealer/media/*`): a dealer
 * never writes vehicle media. The admin upload is the `vehicle-images`
 * module's, behind `requireAdmin`. What remains here is not API surface at
 * all — it is what an S3 presigned PUT and GET would be in production, and it
 * authenticates with the HMAC in its own query string rather than a session.
 */

const storage = createStorageRouter({} as never, {} as never);

describe('the storage router', () => {
  it('declares the presigned PUT, the signed read and the derivative read', () => {
    expect(signaturesOf(storage).sort()).toEqual(
      ['PUT /uploads', 'GET /private', 'GET /media/by-media/:mediaId/:width.webp'].sort(),
    );
  });

  /**
   * No session, no permission — by design. This route stands in for an S3
   * presigned PUT, and its authority comes from the HMAC over key, type,
   * length and expiry that a presign route produced.
   */
  it('asks for no permission, because it is not API surface', () => {
    for (const route of routesOf(storage)) {
      expect(permissionsOn(route), `${route.method} ${route.path}`).toEqual([]);
    }
  });

  it('parses the signed query rather than reading it raw', () => {
    expect(validatedSources(routeFor(storage, 'PUT /uploads') as never)).toContain('query');
    expect(validatedSources(routeFor(storage, 'GET /private') as never)).toContain('query');
  });

  /** Outside `/v1`: storage is not versioned API surface. */
  it('mounts outside the versioned prefix', () => {
    for (const { path } of routesOf(storage)) {
      expect(path, path).not.toContain('/v1');
    }
  });
});
