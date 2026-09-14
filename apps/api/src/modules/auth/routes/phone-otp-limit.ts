import { byUser } from './by-user.js';

export const PHONE_OTP_RATE_LIMITED = 'PHONE_OTP_RATE_LIMITED';
export const PHONE_OTP_RATE_LIMIT_MESSAGE =
  'Too many verification attempts. Try again in a little while.';

/** The shared shape of the three phone limits; only the window and cap differ. */
export function phoneOtpLimit(limit: number, windowSeconds: number) {
  return {
    limit,
    windowSeconds,
    keyBy: byUser,
    code: PHONE_OTP_RATE_LIMITED,
    message: PHONE_OTP_RATE_LIMIT_MESSAGE,
  };
}
