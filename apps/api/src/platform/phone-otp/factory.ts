import { env } from '../../config/env.js';
import { createFakePhoneOtp } from './fake.adapter.js';
import { createMsg91PhoneOtp } from './msg91.adapter.js';
import type { PhoneOtpPort } from './phone-otp.port.js';

export function createPhoneOtp(): PhoneOtpPort {
  return env.PHONE_OTP_DRIVER === 'msg91'
    ? createMsg91PhoneOtp()
    : createFakePhoneOtp(env.PHONE_OTP_DEV_CODE);
}
