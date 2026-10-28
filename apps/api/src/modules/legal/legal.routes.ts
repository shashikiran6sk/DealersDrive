import { Router, type Request } from 'express';

import type { CustomerPrincipal } from '../auth/auth.facade.js';
import type { SessionResolver } from '../auth/auth.facade.js';
import { UnauthorizedError } from '../../platform/errors.js';
import type { LegalService } from './legal.service.js';
import { getLegalStatus } from './routes/get-status.js';
import { postLegalAccept } from './routes/post-accept.js';

export function createLegalRouter(
  service: LegalService,
  sessions: SessionResolver,
  customers: (req: Request) => Promise<CustomerPrincipal | null>,
): Router {
  const router = Router();
  router.use(async (req, _res, next) => {
    try {
      req.principal = (await sessions.resolveSignedIn(req)) ?? (await customers(req)) ?? undefined;
      if (!req.principal) throw new UnauthorizedError();
      next();
    } catch (error) {
      next(error);
    }
  });
  getLegalStatus(router, service);
  postLegalAccept(router, service);
  return router;
}
