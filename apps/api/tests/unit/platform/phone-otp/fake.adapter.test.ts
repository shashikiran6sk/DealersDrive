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

  it('refuses anything that is not a development token', async () => {
    await expect(otp.identify('eyJhbGciOiJIUzI1NiJ9.e30.sig')).resolves.toMatchObject({
      status: 'REJECTED',
    });
  });

  it('reports which driver it is, for the browser to branch on', () => {
    expect(otp.driver).toBe('fake');
  });
});
