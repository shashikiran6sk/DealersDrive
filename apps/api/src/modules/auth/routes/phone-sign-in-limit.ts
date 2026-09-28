import { normaliseIndianMobile } from '@dealers-drive/contracts';
import type { Request } from 'express';

import { isRecord } from '../../../platform/errors.js';
import { PHONE_OTP_RATE_LIMIT_MESSAGE, PHONE_OTP_RATE_LIMITED } from './phone-otp-limit.js';

export function byIp(req: Request): string {
  return req.ip ?? 'unknown';
}

export function byClaimedPhone(req: Request): string {
  const body: unknown = req.body;
  const phone = isRecord(body) && typeof body.phone === 'string' ? body.phone : '';
  return normaliseIndianMobile(phone) ?? 'not-a-number';
}

export function signInLimit(limit: number, windowSeconds: number, keyBy: (req: Request) => string) {
  return {
    limit,
    windowSeconds,
    keyBy,
    code: PHONE_OTP_RATE_LIMITED,
    message: PHONE_OTP_RATE_LIMIT_MESSAGE,
  };
}
