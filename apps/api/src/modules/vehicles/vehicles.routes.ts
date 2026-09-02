import {
  CreateVehicleInput,
  IdParam,
  InventoryQuery,
  MarkSoldInput,
  RcLookupInput,
  UpdateVehicleInput,
  type CreateVehicleInput as CreateVehicleInputType,
  type IdParam as IdParamType,
  type InventoryQuery as InventoryQueryType,
  type MarkSoldInput as MarkSoldInputType,
  type RcLookupInput as RcLookupInputType,
  type UpdateVehicleInput as UpdateVehicleInputType,
} from '@dealers-drive/contracts';
import { Router } from 'express';

import { dealerPrincipal, requireDealerActive, requirePermission } from '../../middleware/auth.js';
import type { RateLimiter } from '../../middleware/rate-limit.js';
import { validate, validated } from '../../middleware/validate.js';
import type { VehiclesService } from './vehicles.service.js';

/**
 * C6–C13. Mounted under `/v1/dealer`, behind `requireDealer`.
 *
 * Note what no handler does: read a dealer id from anywhere but
 * `dealerPrincipal(req)`. That is the whole of rule 1, and it is visible on
 * every line rather than buried in a base class.
 */
export function createVehiclesRouter(service: VehiclesService, rateLimit: RateLimiter): Router {
  const router = Router();

  /**
   * C21 — look a vehicle up by its number plate.
   *
   * The only endpoint in the dealer API that costs money on every call, which
   * is why it is the only one carrying its own limiter. Twenty an hour is far
   * above honest use — a dealer appraising stock does a handful — and far
   * below what would make the console useful as a free VAHAN terminal, which
   * is the actual abuse to prevent. Cost is not the concern: a lookup is
   * roughly ₹3 against a ₹450 listing credit.
   *
   * Keyed by dealership rather than IP: a yard behind one office NAT is one
   * dealer, and rate-limiting them as one IP would punish the shared desk.
   */
  router.post(
    '/vehicles/lookup',
    requirePermission('vehicle:write'),
    rateLimit('rc-lookup', {
      limit: 20,
      windowSeconds: 3600,
      keyBy: (req) => dealerPrincipal(req).dealerId,
      code: 'RC_LOOKUP_LIMIT',
      message:
        'You have looked up a lot of numbers. Try again in an hour, ' +
        'or add the vehicle by entering its details.',
    }),
    validate({ body: RcLookupInput }),
    (req, res, next) => {
      void (async () => {
        try {
          const { dealerId } = dealerPrincipal(req);
          const body = validated<RcLookupInputType>(req, 'body');
          res.json(await service.lookup(dealerId, body));
        } catch (error) {
          next(error);
        }
      })();
    },
  );

  router.get(
    '/vehicles',
    requirePermission('vehicle:read'),
    validate({ query: InventoryQuery }),
    (req, res, next) => {
      void (async () => {
        try {
          const { dealerId } = dealerPrincipal(req);
          const query = validated<InventoryQueryType>(req, 'query');
          res.json(await service.inventory(dealerId, query));
        } catch (error) {
          next(error);
        }
      })();
    },
  );

  router.post(
    '/vehicles',
    requirePermission('vehicle:write'),
    validate({ body: CreateVehicleInput }),
    (req, res, next) => {
      void (async () => {
        try {
          const { dealerId } = dealerPrincipal(req);
          const body = validated<CreateVehicleInputType>(req, 'body');
          res.status(201).json(await service.create(dealerId, body));
        } catch (error) {
          next(error);
        }
      })();
    },
  );

  router.get(
    '/vehicles/:id',
    requirePermission('vehicle:read'),
    validate({ params: IdParam }),
    (req, res, next) => {
      void (async () => {
        try {
          const { dealerId } = dealerPrincipal(req);
          const params = validated<IdParamType>(req, 'params');
          res.json(await service.get(dealerId, params.id));
        } catch (error) {
          next(error);
        }
      })();
    },
  );

  router.patch(
    '/vehicles/:id',
    requirePermission('vehicle:write'),
    validate({ params: IdParam, body: UpdateVehicleInput }),
    (req, res, next) => {
      void (async () => {
        try {
          const { dealerId } = dealerPrincipal(req);
          const params = validated<IdParamType>(req, 'params');
          const body = validated<UpdateVehicleInputType>(req, 'body');
          res.json(await service.update(dealerId, params.id, body));
        } catch (error) {
          next(error);
        }
      })();
    },
  );

  router.delete(
    '/vehicles/:id',
    requirePermission('vehicle:delete'),
    validate({ params: IdParam }),
    (req, res, next) => {
      void (async () => {
        try {
          const { dealerId } = dealerPrincipal(req);
          const params = validated<IdParamType>(req, 'params');
          await service.remove(dealerId, params.id);
          res.status(204).end();
        } catch (error) {
          next(error);
        }
      })();
    },
  );

  router.post(
    '/vehicles/:id/submit',
    requireDealerActive,
    requirePermission('listing:submit'),
    validate({ params: IdParam }),
    (req, res, next) => {
      void (async () => {
        try {
          const { dealerId, userId } = dealerPrincipal(req);
          const params = validated<IdParamType>(req, 'params');
          res.status(201).json(await service.submit(dealerId, userId, params.id));
        } catch (error) {
          next(error);
        }
      })();
    },
  );

  router.post(
    '/vehicles/:id/mark-sold',
    requirePermission('vehicle:write'),
    validate({ params: IdParam, body: MarkSoldInput }),
    (req, res, next) => {
      void (async () => {
        try {
          const { dealerId } = dealerPrincipal(req);
          const params = validated<IdParamType>(req, 'params');
          const body = validated<MarkSoldInputType>(req, 'body');
          res.json(await service.markSold(dealerId, params.id, body));
        } catch (error) {
          next(error);
        }
      })();
    },
  );

  router.post(
    '/vehicles/:id/remove-listing',
    requirePermission('vehicle:write'),
    validate({ params: IdParam }),
    (req, res, next) => {
      void (async () => {
        try {
          const { dealerId } = dealerPrincipal(req);
          const params = validated<IdParamType>(req, 'params');
          res.json(await service.removeListing(dealerId, params.id));
        } catch (error) {
          next(error);
        }
      })();
    },
  );

  router.post(
    '/listings/:id/renew',
    requireDealerActive,
    requirePermission('listing:renew'),
    validate({ params: IdParam }),
    (req, res, next) => {
      void (async () => {
        try {
          const { dealerId, userId } = dealerPrincipal(req);
          const params = validated<IdParamType>(req, 'params');
          res.status(201).json(await service.renew(dealerId, userId, params.id));
        } catch (error) {
          next(error);
        }
      })();
    },
  );

  return router;
}
