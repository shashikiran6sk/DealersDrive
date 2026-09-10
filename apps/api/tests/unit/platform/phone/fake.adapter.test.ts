import { describe, expect, it } from 'vitest';

import { env } from '../../../../src/config/env.js';
import { createFakePhoneVerifier } from '../../../../src/platform/phone/fake.adapter.js';
import { createPhoneVerifier } from '../../../../src/platform/phone/factory.js';

/**
 * The driver that makes the whole flow runnable without Firebase (**R39**).
 *
 * It is a driver, not a stub: the route, the service, the duplicate check and
 * the write all run unmodified above it. The only thing replaced is the
 * question *did Google sign this*, and `env.ts` refuses it in production for
 * exactly that reason — a deployment running it would hand every dealership a
 * verified badge for a handset nobody holds, on a public page.
 */
describe('the fake verifier', () => {
  const verifier = createFakePhoneVerifier();

  it('accepts a well-formed token and returns the number in it', async () => {
    const verified = await verifier.verify('fake:+919840012345');

    expect(verified.phone).toBe('+919840012345');
    expect(verified.providerUserId).toBe('fake:+919840012345');
  });

  /**
   * The third part is what makes the *wrong code* path reachable locally. A
   * developer who cannot see a rejection cannot check that the screen handles
   * one, and "it worked on my machine" is usually a screen that was never shown
   * a refusal.
   */
  it('accepts the configured code', async () => {
    const verified = await verifier.verify(
      `fake:+919840012345:${env.PHONE_VERIFICATION_FAKE_CODE}`,
    );

    expect(verified.phone).toBe('+919840012345');
  });

  it('refuses a code that is not the configured one', async () => {
    await expect(verifier.verify('fake:+919840012345:000000')).rejects.toMatchObject({
      status: 401,
      code: 'PHONE_CODE_INVALID',
    });
  });

  /**
   * A string shaped like a JWT, built rather than written — a literal `eyJ…` in
   * the source is flagged by both `gitleaks` and `semgrep`, correctly, since
   * neither can tell a fixture from a leaked token.
   */
  const jwtShaped = [
    Buffer.from(JSON.stringify({ alg: 'RS256' })).toString('base64url'),
    Buffer.from(JSON.stringify({ sub: 'nobody' })).toString('base64url'),
    'not-a-signature',
  ].join('.');

  it.each([
    ['a real-looking JWT', jwtShaped],
    ['the wrong prefix', 'real:+919840012345'],
    ['no number', 'fake:'],
    ['a number that is not E.164', 'fake:9840012345'],
    ['too many parts', 'fake:+919840012345:123456:extra'],
  ])('refuses %s', async (_label, raw) => {
    await expect(verifier.verify(raw)).rejects.toMatchObject({ code: 'PHONE_TOKEN_INVALID' });
  });

  it('names itself', () => {
    expect(verifier.driver).toBe('fake');
  });
});

/**
 * The seam, resolved once in the container and never by a module. Under test
 * `PHONE_VERIFICATION_DRIVER` is pinned to `fake` by `vitest.config.ts`, which
 * is the branch this can assert without a Firebase project.
 */
describe('the factory', () => {
  it('builds the driver the environment names', () => {
    expect(createPhoneVerifier().driver).toBe(env.PHONE_VERIFICATION_DRIVER);
  });
});
