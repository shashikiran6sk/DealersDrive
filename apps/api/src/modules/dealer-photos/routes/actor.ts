import type { Request } from 'express';

import { dealerPrincipal } from '../../../middleware/auth.js';
import type { DealerPhotoActor } from '../dealer-photos.service.js';

export function photoActorOf(req: Request): DealerPhotoActor {
  const { dealerId, userId, sessionId } = dealerPrincipal(req);
  return { dealerId, userId, ...(sessionId ? { sessionId } : {}) };
}
