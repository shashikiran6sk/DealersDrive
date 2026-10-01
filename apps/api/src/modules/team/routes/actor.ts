import type { Request } from 'express';

import { dealerPrincipal } from '../../../middleware/auth.js';
import type { TeamActor } from '../team.service.js';

export function actorOf(req: Request): TeamActor {
  const { dealerId, userId } = dealerPrincipal(req);
  return { dealerId, userId };
}
