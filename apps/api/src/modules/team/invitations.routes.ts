import { Router } from 'express';

import type { InvitationsService } from './invitations.service.js';
import { getMyInvitations } from './routes/get-my-invitations.js';
import { postInvitationAccept } from './routes/post-invitation-accept.js';
import { postInvitationDecline } from './routes/post-invitation-decline.js';
import type { InvitationsRoute } from './routes/route.js';

const ROUTES: InvitationsRoute[] = [getMyInvitations, postInvitationAccept, postInvitationDecline];

export function createInvitationsRouter(service: InvitationsService): Router {
  const router = Router();
  for (const route of ROUTES) route(router, service);
  return router;
}
