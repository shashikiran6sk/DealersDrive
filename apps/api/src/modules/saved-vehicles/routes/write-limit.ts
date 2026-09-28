import type { RequestHandler, Request } from 'express';

import { customerPrincipal } from '../../../middleware/auth.js';
import type { RateLimiter } from '../../../middleware/rate-limit.js';
import { SAVE_RATE_LIMITED } from '../saved-vehicles.messages.js';

function byCustomer(req: Request): string {
  return customerPrincipal(req).userId;
}

export function writeLimit(rateLimit: RateLimiter): RequestHandler {
  return rateLimit('saved-vehicles.write', {
    limit: 120,
    windowSeconds: 3600,
    keyBy: byCustomer,
    code: 'SAVE_RATE_LIMITED',
    message: SAVE_RATE_LIMITED,
  });
}
