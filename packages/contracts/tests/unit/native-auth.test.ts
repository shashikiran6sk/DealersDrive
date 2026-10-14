import { describe, expect, it } from 'vitest';
import {
  NativeOtpRequestInput,
  NativeOtpVerifyInput,
  NativeCustomerSignIn,
  CustomerSignUpInput,
  LegalPublication,
} from '../../src/native-auth.js';

describe('platform-neutral native customer contract', () => {
  it('keeps signup validation and refuses privileged/unknown OTP fields', () => {
    expect(NativeOtpRequestInput.parse({ phone: '9845599999' }).phone).toBe('9845599999');
    expect(NativeOtpRequestInput.safeParse({ phone: '9845599999', dealerId: 'x' }).success).toBe(
      false,
    );
    expect(
      NativeOtpVerifyInput.safeParse({ challenge: 'signed', otp: '123456', accessToken: 'forged' })
        .success,
    ).toBe(false);
    expect(
      CustomerSignUpInput.safeParse({ signUpToken: 'verified', fullName: 'ಶಶಿಕಿರಣ್' }).success,
    ).toBe(true);
    expect(
      CustomerSignUpInput.safeParse({ signUpToken: 'verified', fullName: '1234' }).success,
    ).toBe(false);
  });
  it('requires a real credential for signed-in responses and a ticket for name-required responses', () => {
    expect(NativeCustomerSignIn.safeParse({ status: 'SIGNED_IN', customer: null }).success).toBe(
      false,
    );
    expect(
      NativeCustomerSignIn.safeParse({
        status: 'NAME_REQUIRED',
        signUpToken: 'verified',
        expiresAt: '2026-10-14T14:00:00.000Z',
        phoneDisplay: '+91 ***** *****',
      }).success,
    ).toBe(true);
    expect(
      NativeCustomerSignIn.safeParse({ status: 'NAME_REQUIRED', credential: { token: 'invalid' } })
        .success,
    ).toBe(false);
  });
  it('represents absent published documents without inventing legal content', () => {
    expect(
      LegalPublication.parse({
        state: 'UNAVAILABLE',
        collectionEnabled: false,
        documents: [],
        sharing: null,
      }),
    ).toMatchObject({ state: 'UNAVAILABLE', documents: [] });
  });
});
