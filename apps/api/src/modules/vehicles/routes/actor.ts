import type { Request } from 'express';

import { dealerPrincipal } from '../../../middleware/auth.js';
import type { VehicleActor } from '../vehicles.service.js';

export function actorOf(req: Request): VehicleActor {
  const { dealerId, userId } = dealerPrincipal(req);
  return { dealerId, userId };
}
