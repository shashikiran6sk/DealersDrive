import {
  IdParam,
  ReorderImagesInput,
  type IdParam as IdParamType,
  type ReorderImagesInput as ReorderImagesInputType,
} from '@dealers-drive/contracts';

import { adminPrincipal, requirePermission } from '../../../middleware/auth.js';
import { validate, validated } from '../../../middleware/validate.js';

import { handle, type VehicleImagesRoute } from './route.js';

export const putListingImagesOrder: VehicleImagesRoute = (router, service) => {
  router.put(
    '/listings/:id/images/order',
    requirePermission('admin:media:upload'),
    validate({ params: IdParam, body: ReorderImagesInput }),
    handle((req) =>
      service.reorder(
        adminPrincipal(req),
        validated<IdParamType>(req, 'params').id,
        validated<ReorderImagesInputType>(req, 'body'),
      ),
    ),
  );
};
