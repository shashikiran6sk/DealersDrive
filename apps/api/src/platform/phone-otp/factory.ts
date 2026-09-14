import { env } from '../../config/env.js';
import { createFakePhoneOtp } from './fake.adapter.js';
import { createMsg91PhoneOtp } from './msg91.adapter.js';
import type { PhoneOtpPort } from './phone-otp.port.js';

/**
 * The `PHONE_OTP_DRIVER` seam, resolved once in the container (**R39**).
 *
 * `env.ts` refuses `msg91` without the auth key and the two widget values, and
 * refuses `fake` in production — so neither branch can be reached in a state it
 * cannot serve. The failure is a refused boot naming a variable rather than a
 * dealer discovering at the sign-up screen that no code ever arrives.
 */
export function createPhoneOtp(): PhoneOtpPort {
  return env.PHONE_OTP_DRIVER === 'msg91'
    ? createMsg91PhoneOtp()
    : createFakePhoneOtp(env.PHONE_OTP_DEV_CODE);
}
