import {
  CreateOrderInput,
  CursorQuery,
  IdParam,
  VerifyOrderInput,
  type CreateOrderInput as CreateOrderInputType,
  type CursorQuery as CursorQueryType,
  type IdParam as IdParamType,
  type VerifyOrderInput as VerifyOrderInputType,
} from '@dealers-drive/contracts';
import { Router } from 'express';

import { dealerPrincipal, requirePermission } from '../../middleware/auth.js';
import { rateLimit } from '../../middleware/rate-limit.js';
import { validate, validated } from '../../middleware/validate.js';
import type { StoragePort } from '../../platform/storage/storage.port.js';
import type { BillingService } from './billing.service.js';

/** C19. `billing:read` for the panels, `billing:purchase` (OWNER only) to spend. */
export function createBillingRouter(service: BillingService, storage: StoragePort): Router {
  const router = Router();

  router.get('/billing/summary', requirePermission('billing:read'), (req, res, next) => {
    void (async () => {
      try {
        const { dealerId } = dealerPrincipal(req);
        res.json(await service.summary(dealerId));
      } catch (error) {
        next(error);
      }
    })();
  });

  router.get('/billing/packs', requirePermission('billing:read'), (_req, res, next) => {
    void (async () => {
      try {
        res.json(await service.packs());
      } catch (error) {
        next(error);
      }
    })();
  });

  router.post(
    '/billing/orders',
    requirePermission('billing:purchase'),
    rateLimit('billing-orders', {
      limit: 10,
      windowSeconds: 3600,
      keyBy: (req) => dealerPrincipal(req).dealerId,
    }),
    validate({ body: CreateOrderInput }),
    (req, res, next) => {
      void (async () => {
        try {
          const { dealerId, userId } = dealerPrincipal(req);
          const body = validated<CreateOrderInputType>(req, 'body');
          res.status(201).json(await service.createOrder(dealerId, userId, body));
        } catch (error) {
          next(error);
        }
      })();
    },
  );

  router.post(
    '/billing/orders/:id/verify',
    requirePermission('billing:purchase'),
    validate({ params: IdParam, body: VerifyOrderInput }),
    (req, res, next) => {
      void (async () => {
        try {
          const { dealerId } = dealerPrincipal(req);
          const params = validated<IdParamType>(req, 'params');
          const body = validated<VerifyOrderInputType>(req, 'body');
          const result = await service.verifyOrder(dealerId, params.id, body);
          res.status(result.orderStatus === 'PAID' ? 200 : 202).json(result);
        } catch (error) {
          next(error);
        }
      })();
    },
  );

  router.get(
    '/billing/ledger',
    requirePermission('billing:read'),
    validate({ query: CursorQuery }),
    (req, res, next) => {
      void (async () => {
        try {
          const { dealerId } = dealerPrincipal(req);
          const query = validated<CursorQueryType>(req, 'query');
          res.json(await service.ledger(dealerId, query));
        } catch (error) {
          next(error);
        }
      })();
    },
  );

  router.get(
    '/billing/invoices',
    requirePermission('billing:read'),
    validate({ query: CursorQuery }),
    (req, res, next) => {
      void (async () => {
        try {
          const { dealerId } = dealerPrincipal(req);
          const query = validated<CursorQueryType>(req, 'query');
          res.json(await service.invoices(dealerId, query));
        } catch (error) {
          next(error);
        }
      })();
    },
  );

  // 302 to a 5-minute signed URL, scoped to the caller's own invoices (§26.5).
  router.get(
    '/billing/invoices/:id/pdf',
    requirePermission('billing:read'),
    validate({ params: IdParam }),
    (req, res, next) => {
      void (async () => {
        try {
          const { dealerId } = dealerPrincipal(req);
          const params = validated<IdParamType>(req, 'params');
          const key = await service.invoicePdfKey(dealerId, params.id);
          res.redirect(302, storage.signedReadUrl(key, 300));
        } catch (error) {
          next(error);
        }
      })();
    },
  );

  return router;
}
