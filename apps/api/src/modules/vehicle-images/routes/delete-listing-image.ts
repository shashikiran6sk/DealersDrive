import {
  ListingImageParam,
  type ListingImageParam as ListingImageParamType,
} from '@dealers-drive/contracts';

import { adminPrincipal, requirePermission } from '../../../middleware/auth.js';
import { validate, validated } from '../../../middleware/validate.js';

import { handle, type VehicleImagesRoute } from './route.js';

export const deleteListingImage: VehicleImagesRoute = (router, service) => {
  router.delete(
    '/listings/:id/images/:mediaId',
    requirePermission('admin:media:upload'),
    validate({ params: ListingImageParam }),
    handle((req) => {
      const params = validated<ListingImageParamType>(req, 'params');
      return service.remove(adminPrincipal(req), params.id, params.mediaId);
    }),
  );
};
