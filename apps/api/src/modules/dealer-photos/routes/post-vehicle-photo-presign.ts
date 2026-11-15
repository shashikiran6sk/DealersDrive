import {
  DealerPhotoPresignInput,
  IdParam,
  type DealerPhotoPresignInput as DealerPhotoPresignInputType,
  type IdParam as IdParamType,
} from '@dealers-drive/contracts';

import { requirePermission } from '../../../middleware/auth.js';
import { validate, validated } from '../../../middleware/validate.js';

import { photoActorOf } from './actor.js';
import { handle, type DealerPhotosRoute } from './route.js';

export const postVehiclePhotoPresign: DealerPhotosRoute = (router, service) => {
  router.post(
    '/vehicles/:id/photos/presign',
    requirePermission('vehicle:write'),
    validate({ params: IdParam, body: DealerPhotoPresignInput }),
    handle(
      (req) =>
        service.presign(
          photoActorOf(req),
          validated<IdParamType>(req, 'params').id,
          validated<DealerPhotoPresignInputType>(req, 'body'),
        ),
      201,
    ),
  );
};
