import {
  ActivationOverrideInput,
  IdParam,
  type ActivationOverrideInput as ActivationOverrideInputType,
  type IdParam as IdParamType,
} from '@dealers-drive/contracts';

import { adminPrincipal } from '../../../middleware/auth.js';
import { validate, validated } from '../../../middleware/validate.js';

import { handle, type AdminRoute } from './route.js';

export const postDealerActivationOverride: AdminRoute = (router, service) => {
  router.post(
    '/dealers/:id/activation-override',
    validate({ params: IdParam, body: ActivationOverrideInput }),
    handle((req) =>
      service.activation.override(
        adminPrincipal(req),
        validated<IdParamType>(req, 'params').id,
        validated<ActivationOverrideInputType>(req, 'body'),
      ),
    ),
  );
};
