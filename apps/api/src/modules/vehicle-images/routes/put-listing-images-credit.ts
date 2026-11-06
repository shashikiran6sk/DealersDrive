import {
  IdParam,
  SetVehicleImageCreditInput,
  type IdParam as IdParamType,
  type SetVehicleImageCreditInput as SetVehicleImageCreditInputType,
} from '@dealers-drive/contracts';

import { adminPrincipal, requirePermission } from '../../../middleware/auth.js';
import { validate, validated } from '../../../middleware/validate.js';

import { handle, type VehicleImagesRoute } from './route.js';

export const putListingImagesCredit: VehicleImagesRoute = (router, service) => {
  router.put(
    '/listings/:id/images/credit',
    requirePermission('admin:media:upload'),
    validate({ params: IdParam, body: SetVehicleImageCreditInput }),
    handle((req) =>
      service.setAllCredits(
        adminPrincipal(req),
        validated<IdParamType>(req, 'params').id,
        validated<SetVehicleImageCreditInputType>(req, 'body').credit,
      ),
    ),
  );
};
