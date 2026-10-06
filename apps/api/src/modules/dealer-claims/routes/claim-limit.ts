import type { Request } from 'express';

import { byClaimedPhone, byIp } from '../../auth/routes/phone-sign-in-limit.js';

export const CLAIM_RATE_LIMITED = 'CLAIM_RATE_LIMITED';

export const CLAIM_RATE_LIMIT_MESSAGE =
  'Too many attempts on this link. Try again in a few minutes.';

export function claimLimit(limit: number, windowSeconds: number, keyBy: (req: Request) => string) {
  return {
    limit,
    windowSeconds,
    keyBy,
    code: CLAIM_RATE_LIMITED,
    message: CLAIM_RATE_LIMIT_MESSAGE,
  };
}

export { byClaimedPhone, byIp };
