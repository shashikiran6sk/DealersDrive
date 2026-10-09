import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { env } from '../src/config/env.js';
import { createAuthHarness, type AuthHarness } from './auth-harness.js';
let h: AuthHarness;
beforeAll(async () => {
  h = await createAuthHarness();
});
afterAll(async () => {
  await h.close();
});
function adminClaims() {
  h.google.claims = {
    subject: 'admin-isolation-google',
    email: env.adminAllowlist[0] ?? '',
    emailVerified: true,
    name: 'Synthetic Isolation Administrator',
  };
}
describe('admin and person authentication isolation', () => {
  it('keeps a person session available after admin login and admin logout', async () => {
    adminClaims();
    const agent = h.agent();
    await h.signInAdmin(agent);
    await h.signIn(agent);
    const person = await agent.get('/v1/auth/me').expect(200);
    await agent.get('/v1/admin/metrics/overview').expect(200);
    await agent.post('/v1/auth/admin/logout').expect(204);
    expect((await agent.get('/v1/auth/me').expect(200)).body.user.id).toBe(person.body.user.id);
    await agent.get('/v1/admin/metrics/overview').expect(401);
  });
  it('keeps admin access after person logout and records Google assurance', async () => {
    adminClaims();
    const agent = h.agent();
    await h.signInAdmin(agent);
    await h.signIn(agent);
    const person = await agent.get('/v1/auth/me').expect(200);
    const session = await h.prisma.session.findFirstOrThrow({
      where: { userId: person.body.user.id as string, scope: 'ADMIN', revokedAt: null },
      orderBy: { createdAt: 'desc' },
    });
    expect(session.authenticationMethod).toBe('GOOGLE');
    await agent.post('/v1/auth/logout').expect(204);
    await agent.get('/v1/auth/me').expect(401);
    await agent.get('/v1/admin/metrics/overview').expect(200);
  });
  it('keeps parallel signed Google transactions separate across audiences', async () => {
    adminClaims();
    const agent = h.agent();
    await agent.get('/v1/auth/admin/google/start').expect(302);
    const adminState = h.google.lastRequest?.state;
    await agent.get('/v1/auth/google/start').expect(302);
    const personState = h.google.lastRequest?.state;
    await agent
      .get('/v1/auth/google/callback')
      .query({ state: adminState, code: 'controlled-google-code' })
      .expect(302);
    await agent.get('/v1/admin/metrics/overview').expect(200);
    await agent
      .get('/v1/auth/google/callback')
      .query({ state: personState, code: 'controlled-google-code' })
      .expect(302);
    await agent.get('/v1/auth/me').expect(200);
    await agent.get('/v1/admin/metrics/overview').expect(200);
  });
});
