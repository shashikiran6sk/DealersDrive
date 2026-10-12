import {
  RevokeActivationOverrideInput,
  IdParam,
  type RevokeActivationOverrideInput as RevokeActivationOverrideInputType,
  type IdParam as IdParamType,
} from '@dealers-drive/contracts';

import { adminPrincipal } from '../../../middleware/auth.js';
import { validate, validated } from '../../../middleware/validate.js';

import { handle, type AdminRoute } from './route.js';

export const postDealerActivationOverrideRevoke: AdminRoute = (router, service) => {
  router.post(
    '/dealers/:id/activation-override/revoke',
    validate({ params: IdParam, body: RevokeActivationOverrideInput }),
    handle((req) =>
      service.activation.revoke(
        adminPrincipal(req),
        validated<IdParamType>(req, 'params').id,
        validated<RevokeActivationOverrideInputType>(req, 'body'),
      ),
    ),
  );
};
