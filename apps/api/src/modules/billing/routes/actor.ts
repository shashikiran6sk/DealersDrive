import type { Request } from 'express';

import { dealerPrincipal } from '../../../middleware/auth.js';
import type { BillingActor } from '../billing.service.js';

export function billingActorOf(req: Request): BillingActor {
  const { dealerId, userId, permissions } = dealerPrincipal(req);
  return { dealerId, userId, permissions };
}
