import type { PhoneOtpPort, PhoneOtpVerdict } from './phone-otp.port.js';

/**
 * The no-SMS driver — `pnpm dev`, the test suite, and any preview environment
 * without an MSG91 account (**R39**).
 *
 * It is a real implementation of the port rather than a stub: onboarding works
 * end to end on it, including the refusals. What it does not do is send
 * anything or reach the network.
 *
 * **The token shape is explicit on purpose.** Under this driver the browser
 * never loads the widget script, so there is no provider to mint a token —
 * the page builds one itself, and it has to say *which* number it is claiming
 * or the binding check in `phone.service.ts` would have nothing to compare
 * against. `dev-otp:919840012345:123456` is that shape, and it is unmistakable
 * in a log: nobody will confuse it for something MSG91 issued.
 *
 * **Anything after the code is ignored**, which is what lets a caller make one
 * of these unique. The replay guard in `phone.service.ts` remembers a token for
 * fifteen minutes, so without a nonce a developer who verified the same number
 * twice in one sitting would be told their code had already been used — a
 * refusal about the fixture rather than about anything the product does.
 *
 * It cannot be reached in production. `env.ts` refuses `PHONE_OTP_DRIVER=fake`
 * there, and the MSG91 adapter would hand this string to MSG91, which rejects
 * it — two independent reasons, which is the number a development bypass
 * should have.
 */
export const DEV_OTP_PREFIX = 'dev-otp:';

export function createFakePhoneOtp(devCode: string): PhoneOtpPort {
  return {
    driver: 'fake',

    identify(accessToken: string): Promise<PhoneOtpVerdict> {
      return Promise.resolve(verdict(accessToken, devCode));
    },
  };
}

function verdict(accessToken: string, devCode: string): PhoneOtpVerdict {
  if (!accessToken.startsWith(DEV_OTP_PREFIX)) {
    return { status: 'REJECTED', reason: 'not a development verification token' };
  }

  const [identifier, code] = accessToken.slice(DEV_OTP_PREFIX.length).split(':');

  // The code is checked rather than ignored. A driver that accepted anything
  // would let a wrong-code test pass for the wrong reason, and the failure
  // path is the half of this feature most worth exercising locally.
  if (code !== devCode) return { status: 'REJECTED', reason: 'wrong code' };
  if (!identifier || !/^\d{8,15}$/.test(identifier)) {
    return { status: 'REJECTED', reason: 'no identifier in the token' };
  }

  return { status: 'VERIFIED', identifier };
}
