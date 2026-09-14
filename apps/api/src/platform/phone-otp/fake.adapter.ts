import type { PhoneOtpPort, PhoneOtpVerdict } from './phone-otp.port.js';

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

  if (code !== devCode) return { status: 'REJECTED', reason: 'wrong code' };
  if (!identifier || !/^\d{8,15}$/.test(identifier)) {
    return { status: 'REJECTED', reason: 'no identifier in the token' };
  }

  return { status: 'VERIFIED', identifier };
}
