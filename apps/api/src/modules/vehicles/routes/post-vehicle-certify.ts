import { requireLegalOrigin } from '../../legal/legal.facade.js';
import { IdParam, SubmitVehicleInput, type IdParam as IdParamType } from '@dealers-drive/contracts';
import { requireDealerActive, requirePermission } from '../../../middleware/auth.js';
import { validate, validated } from '../../../middleware/validate.js';
import { actorOf } from './actor.js';
import { handle, type VehiclesRoute } from './route.js';
export const postVehicleCertify: VehiclesRoute = (router, service) => {
  router.post(
    '/vehicles/:id/certify',
    requireLegalOrigin,
    requirePermission('listing:submit'),
    requireDealerActive,
    validate({ params: IdParam, body: SubmitVehicleInput }),
    handle((req) =>
      service.certifyAssisted(
        actorOf(req),
        validated<IdParamType>(req, 'params').id,
        validated<SubmitVehicleInput>(req, 'body'),
      ),
    ),
  );
};
