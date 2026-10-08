import { requireLegalOrigin } from './legal-origin.js';
import { Router } from 'express';
import type { LegalService } from './legal.service.js';
import { getStatus } from './routes/get-status.js';
import { getHistory } from './routes/get-history.js';
import { postTerms } from './routes/post-terms.js';
import { postDealerAgreement } from './routes/post-dealer-agreement.js';
export function createLegalRouter(service: LegalService, dealer = false): Router {
  const router = Router();
  router.use((req, res, next) =>
    req.method === 'POST' ? requireLegalOrigin(req, res, next) : next(),
  );
  for (const register of [getStatus, getHistory, postTerms]) register(router, service);
  if (dealer) postDealerAgreement(router, service);
  return router;
}
