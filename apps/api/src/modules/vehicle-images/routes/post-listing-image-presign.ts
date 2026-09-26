import {
  IdParam,
  VehicleImagePresignInput,
  type IdParam as IdParamType,
  type VehicleImagePresignInput as VehicleImagePresignInputType,
} from '@dealers-drive/contracts';

import { requirePermission } from '../../../middleware/auth.js';
import { validate, validated } from '../../../middleware/validate.js';

import { handle, type VehicleImagesRoute } from './route.js';

export const postListingImagePresign: VehicleImagesRoute = (router, service) => {
  router.post(
    '/listings/:id/images/presign',
    requirePermission('admin:media:upload'),
    validate({ params: IdParam, body: VehicleImagePresignInput }),
    handle(
      (req) =>
        service.presign(
          validated<IdParamType>(req, 'params').id,
          validated<VehicleImagePresignInputType>(req, 'body'),
        ),
      201,
    ),
  );
};
