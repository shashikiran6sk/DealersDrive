import { describe, expect, it } from 'vitest';
import request from 'supertest';
import express from 'express';

import type { Container } from '../../src/container.js';
import { createRoutes } from '../../src/routes.js';

/**
 * One file to read to know the whole surface area of the API — and one file
 * where the guard chains are visible together:
 *
 *   /v1/…          public, no principal
 *   /v1/auth/…     mixed — sign-in open, `/me` and `/onboarding` guarded
 *   /v1/dealer/…   requireDealer  — dealerId enters the request context here
 *   /v1/admin/…    requireAdmin
 *
 * The mount point *is* the authorization boundary, so what has to be proven is
 * that no dealer or admin path is reachable without passing its guard first.
 *
 * ── Reconstruction note ───────────────────────────────────────────────────
 * Nothing is mounted yet, so there is no boundary to prove. What F002 can pin
 * is that the `/v1` versioning boundary exists and that an unmatched path
 * falls through rather than being answered — the property every later mount
 * depends on. The guard-chain tests arrive with F016, which brings the guards,
 * and grow with each module that mounts under them.
 */

function harness() {
  const app = express();
  app.use(createRoutes({} as unknown as Container));
  return app;
}

describe('the mount table', () => {
  it('returns a router that can be mounted', () => {
    expect(typeof createRoutes({} as unknown as Container)).toBe('function');
  });

  it('falls through an unmatched path rather than answering it', async () => {
    const response = await request(harness()).get('/v1/nothing-is-mounted-here');

    // 404 from Express's own fallback. F003's not-found turns this into a
    // problem document; until then, falling through is the property that
    // matters — a router that answered would shadow every later mount.
    expect(response.status).toBe(404);
  });

  it('does not answer outside its own prefixes', async () => {
    const response = await request(harness()).get('/not-a-prefix');

    expect(response.status).toBe(404);
  });
});
