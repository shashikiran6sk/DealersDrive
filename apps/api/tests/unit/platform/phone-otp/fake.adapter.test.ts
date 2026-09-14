import { describe, expect, it } from 'vitest';

import { createFakePhoneOtp } from '../../../../src/platform/phone-otp/fake.adapter.js';

/**
 * R39 — the no-SMS driver.
 *
 * It is a real implementation of the port, and the thing worth asserting is
 * that it is not a rubber stamp: a development bypass that accepted anything
 * would let the wrong-code path pass for the wrong reason, and that path is
 * the half of this feature most worth exercising locally.
 */
const otp = createFakePhoneOtp('123456');

describe('the fake phone-OTP driver', () => {
  it('names the identifier the token carries', async () => {
    await expect(otp.identify('dev-otp:919840012345:123456')).resolves.toEqual({
      status: 'VERIFIED',
      identifier: '919840012345',
    });
  });

  it('refuses a wrong code', async () => {
    await expect(otp.identify('dev-otp:919840012345:000000')).resolves.toMatchObject({
      status: 'REJECTED',
    });
  });

  it('refuses a token with no identifier in it', async () => {
    await expect(otp.identify('dev-otp::123456')).resolves.toMatchObject({ status: 'REJECTED' });
  });

  /**
   * Something MSG91 might plausibly have issued — which this driver must still
   * refuse, because it has no way to check a signature and no business
   * pretending otherwise.
   *
   * Built at runtime rather than written as a literal: a JWT-shaped string in
   * source is a thing every secret scanner has to treat as a leak, correctly,
   * since none of them can tell a fixture from a real token.
   */
  it('refuses anything that is not a development token', async () => {
    const segment = (value: object): string =>
      Buffer.from(JSON.stringify(value)).toString('base64url');
    const jwt = `${segment({ alg: 'HS256' })}.${segment({ identifier: '919840012345' })}.signature`;

    await expect(otp.identify(jwt)).resolves.toMatchObject({ status: 'REJECTED' });
  });

  it('reports which driver it is, for the browser to branch on', () => {
    expect(otp.driver).toBe('fake');
  });
});
