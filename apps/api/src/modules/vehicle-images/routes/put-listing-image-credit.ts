import {
  ListingImageParam,
  SetVehicleImageCreditInput,
  type ListingImageParam as ListingImageParamType,
  type SetVehicleImageCreditInput as SetVehicleImageCreditInputType,
} from '@dealers-drive/contracts';

import { adminPrincipal, requirePermission } from '../../../middleware/auth.js';
import { validate, validated } from '../../../middleware/validate.js';

import { handle, type VehicleImagesRoute } from './route.js';

export const putListingImageCredit: VehicleImagesRoute = (router, service) => {
  router.put(
    '/listings/:id/images/:mediaId/credit',
    requirePermission('admin:media:upload'),
    validate({ params: ListingImageParam, body: SetVehicleImageCreditInput }),
    handle((req) => {
      const params = validated<ListingImageParamType>(req, 'params');
      const body = validated<SetVehicleImageCreditInputType>(req, 'body');
      return service.setCredit(adminPrincipal(req), params.id, params.mediaId, body.credit);
    }),
  );
};
