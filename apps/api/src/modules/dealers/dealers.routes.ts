import { Router } from 'express';

import { dealerPrincipal } from '../../middleware/auth.js';
import type { DealersService } from './dealers.service.js';

/**
 * C1–C5 and C18. Mounted under `/v1/dealer`.
 *
 * The line this router draws is between *reading* your dealership and
 * *changing* it. Reads are open to any seat that got through `requireDealer` —
 * a salesperson can see the dashboard. Writes are OWNER-only, because the
 * profile and the KYC documents are the dealership's identity.
 *
 * ── Reconstruction slice ────────────────────────────────────────────────────
 * **F040 mounts one route**, the document checklist. The other eight arrive
 * with the features that own them: `GET|PATCH /` with **F041** (the Documents
 * step's GSTIN/PAN form is their first consumer), the presign, commit and
 * delete paths with **F041**, `GET /completeness` with **F043**, `POST /submit`
 * with **F042**, and `GET /dashboard` with **F048**.
 * ────────────────────────────────────────────────────────────────────────────
 */
export function createDealersRouter(service: DealersService): Router {
  const router = Router();

  router.get('/documents', (req, res, next) => {
    void (async () => {
      try {
        const { dealerId } = dealerPrincipal(req);
        res.json(await service.documents(dealerId));
      } catch (error) {
        next(error);
      }
    })();
  });

  return router;
}
