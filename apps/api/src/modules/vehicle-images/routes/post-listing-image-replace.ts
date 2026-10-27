import {
  ListingImageParam,
  ReplaceVehicleImageInput,
  type ListingImageParam as ListingImageParamType,
  type ReplaceVehicleImageInput as ReplaceVehicleImageInputType,
} from '@dealers-drive/contracts';

import { adminPrincipal, requirePermission } from '../../../middleware/auth.js';
import { validate, validated } from '../../../middleware/validate.js';
import { handle, type VehicleImagesRoute } from './route.js';

export const postListingImageReplace: VehicleImagesRoute = (router, service) => {
  router.post(
    '/listings/:id/images/:mediaId/replace',
    requirePermission('admin:media:upload'),
    validate({ params: ListingImageParam, body: ReplaceVehicleImageInput }),
    handle((req) => {
      const params = validated<ListingImageParamType>(req, 'params');
      const body = validated<ReplaceVehicleImageInputType>(req, 'body');
      return service.commit(
        adminPrincipal(req),
        params.id,
        body.replacementMediaId,
        params.mediaId,
      );
    }),
  );
};
