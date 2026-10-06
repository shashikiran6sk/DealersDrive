import type { Request } from 'express';

import { adminPrincipal } from '../../../middleware/auth.js';
import {
  PHONE_OTP_RATE_LIMIT_MESSAGE,
  PHONE_OTP_RATE_LIMITED,
} from '../../auth/routes/phone-otp-limit.js';

function byMember(req: Request): string {
  return adminPrincipal(req).userId;
}

export function salesPhoneLimit(limit: number, windowSeconds: number) {
  return {
    limit,
    windowSeconds,
    keyBy: byMember,
    code: PHONE_OTP_RATE_LIMITED,
    message: PHONE_OTP_RATE_LIMIT_MESSAGE,
  };
}
