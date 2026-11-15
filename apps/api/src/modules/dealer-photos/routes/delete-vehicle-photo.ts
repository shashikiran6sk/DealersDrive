import {
  VehiclePhotoParam,
  type VehiclePhotoParam as VehiclePhotoParamType,
} from '@dealers-drive/contracts';

import { requirePermission } from '../../../middleware/auth.js';
import { validate, validated } from '../../../middleware/validate.js';

import { photoActorOf } from './actor.js';
import { handle, type DealerPhotosRoute } from './route.js';

export const deleteVehiclePhoto: DealerPhotosRoute = (router, service) => {
  router.delete(
    '/vehicles/:id/photos/:mediaId',
    requirePermission('vehicle:write'),
    validate({ params: VehiclePhotoParam }),
    handle((req) => {
      const { id, mediaId } = validated<VehiclePhotoParamType>(req, 'params');
      return service.remove(photoActorOf(req), id, mediaId);
    }),
  );
};
