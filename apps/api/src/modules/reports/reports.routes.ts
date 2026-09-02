import { IdParam, type IdParam as IdParamType } from '@dealers-drive/contracts';
import { Router } from 'express';

import { dealerPrincipal, requirePermission } from '../../middleware/auth.js';
import type { RateLimiter } from '../../middleware/rate-limit.js';
import { validate, validated } from '../../middleware/validate.js';
import type { VehiclesService } from '../vehicles/vehicles.facade.js';

/**
 * C22–C23. Mounted under `/v1/dealer`, behind `requireDealer`.
 *
 * Same rule as every other dealer route: the dealer id comes from
 * `dealerPrincipal(req)` and from nowhere else, and a vehicle belonging to
 * another dealership answers 404 rather than 403.
 *
 * Both handlers go through `vehicles` rather than `reports` directly. That is
 * not indirection for its own sake: `vehicles` owns the ownership check, and a
 * router that could read a report by id alone would be one refactor away from
 * serving one dealer's records to another.
 */
export function createReportsRouter(vehicles: VehiclesService, rateLimit: RateLimiter): Router {
  const router = Router();

  router.get(
    '/vehicles/:id/report',
    requirePermission('vehicle:read'),
    validate({ params: IdParam }),
    (req, res, next) => {
      void (async () => {
        try {
          const { dealerId } = dealerPrincipal(req);
          const params = validated<IdParamType>(req, 'params');
          res.json(await vehicles.report(dealerId, params.id));
        } catch (error) {
          next(error);
        }
      })();
    },
  );

  /**
   * C23 — force a re-fetch.
   *
   * Its own limiter, tighter than the intake one, because this is the only
   * endpoint in the product where a dealer can spend our money by holding down
   * a button. Ten an hour is far above honest use — a dealer refreshes when
   * they have just paid a challan — and far below anything worth worrying
   * about on the invoice.
   */
  router.post(
    '/vehicles/:id/report/refresh',
    requirePermission('vehicle:write'),
    rateLimit('report-refresh', {
      limit: 10,
      windowSeconds: 3600,
      keyBy: (req) => dealerPrincipal(req).dealerId,
      code: 'REPORT_REFRESH_LIMIT',
      message: 'You have refreshed records several times. Try again in an hour.',
    }),
    validate({ params: IdParam }),
    (req, res, next) => {
      void (async () => {
        try {
          const { dealerId } = dealerPrincipal(req);
          const params = validated<IdParamType>(req, 'params');
          res.json(await vehicles.refreshReport(dealerId, params.id));
        } catch (error) {
          next(error);
        }
      })();
    },
  );

  return router;
}
