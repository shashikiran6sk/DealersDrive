import {
  AddServiceDistrictInput,
  ServiceLocationParam,
  ServiceLocationSettings,
} from '@dealers-drive/contracts';
import { Router } from 'express';
import { adminPrincipal } from '../../middleware/auth.js';
import { validate, validated } from '../../middleware/validate.js';
import type { ServiceLocationsService } from './service-locations.service.js';

export function createPublicServiceLocationsRouter(service: ServiceLocationsService) {
  const router = Router();
  router.get('/service-locations', async (_req, res) => {
    res.set('Cache-Control', 'no-store');
    res.json(await service.catalogue(true));
  });
  return router;
}
export function createAdminServiceLocationsRouter(service: ServiceLocationsService) {
  const router = Router();
  router.get('/service-locations', async (_req, res) => {
    res.json(await service.catalogue());
  });
  router.get('/service-locations/history', async (req, res) => {
    res.json(await service.history(adminPrincipal(req)));
  });
  for (const kind of ['state', 'district'] as const) {
    router.put(
      `/service-locations/${kind}/:id`,
      validate({ params: ServiceLocationParam, body: ServiceLocationSettings }),
      async (req, res) => {
        const { id } = validated<{ id: string }>(req, 'params');
        res.json(
          await service.change(
            adminPrincipal(req),
            kind,
            id,
            validated<ServiceLocationSettings>(req, 'body'),
          ),
        );
      },
    );
  }
  router.post(
    '/service-locations/districts',
    validate({ body: AddServiceDistrictInput }),
    async (req, res) => {
      res
        .status(201)
        .json(
          await service.addDistrict(
            adminPrincipal(req),
            validated<AddServiceDistrictInput>(req, 'body'),
          ),
        );
    },
  );
  return router;
}
