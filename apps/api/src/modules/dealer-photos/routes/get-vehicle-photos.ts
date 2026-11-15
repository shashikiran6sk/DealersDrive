import { IdParam, type IdParam as IdParamType } from '@dealers-drive/contracts';

import { dealerPrincipal, requirePermission } from '../../../middleware/auth.js';
import { validate, validated } from '../../../middleware/validate.js';

import { handle, type DealerPhotosRoute } from './route.js';

export const getVehiclePhotos: DealerPhotosRoute = (router, service) => {
  router.get(
    '/vehicles/:id/photos',
    requirePermission('vehicle:read'),
    validate({ params: IdParam }),
    handle((req) =>
      service.view(dealerPrincipal(req).dealerId, validated<IdParamType>(req, 'params').id),
    ),
  );
};
