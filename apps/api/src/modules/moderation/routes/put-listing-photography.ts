import {
  IdParam,
  SetPhotographyInput,
  type IdParam as IdParamType,
  type SetPhotographyInput as SetPhotographyInputType,
} from '@dealers-drive/contracts';

import { adminPrincipal, requirePermission } from '../../../middleware/auth.js';
import { validate, validated } from '../../../middleware/validate.js';

import { handle, type ModerationRoute } from './route.js';

export const putListingPhotography: ModerationRoute = (router, service) => {
  router.put(
    '/listings/:id/photography',
    requirePermission('admin:listing:moderate'),
    validate({ params: IdParam, body: SetPhotographyInput }),
    handle((req) =>
      service.setPhotography(
        adminPrincipal(req),
        validated<IdParamType>(req, 'params').id,
        validated<SetPhotographyInputType>(req, 'body'),
      ),
    ),
  );
};
