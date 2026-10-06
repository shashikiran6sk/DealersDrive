import type { Request } from 'express';

import { dealerPrincipal } from '../../../middleware/auth.js';
import type { VehicleActor } from '../vehicles.service.js';

export function actorOf(req: Request): VehicleActor {
  const { dealerId, userId, permissions, sessionId } = dealerPrincipal(req);
  return { dealerId, userId, permissions, ...(sessionId ? { sessionId } : {}) };
}
