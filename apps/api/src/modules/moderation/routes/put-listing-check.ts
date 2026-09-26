import {
  ListingCheckParam,
  SetListingCheckInput,
  type ListingCheckParam as ListingCheckParamType,
  type SetListingCheckInput as SetListingCheckInputType,
} from '@dealers-drive/contracts';

import { adminPrincipal, requirePermission } from '../../../middleware/auth.js';
import { validate, validated } from '../../../middleware/validate.js';

import { handle, type ModerationRoute } from './route.js';

export const putListingCheck: ModerationRoute = (router, service) => {
  router.put(
    '/listings/:id/checks/:key',
    requirePermission('admin:listing:moderate'),
    validate({ params: ListingCheckParam, body: SetListingCheckInput }),
    handle((req) => {
      const params = validated<ListingCheckParamType>(req, 'params');
      return service.setCheck(
        adminPrincipal(req),
        params.id,
        params.key,
        validated<SetListingCheckInputType>(req, 'body').checked,
      );
    }),
  );
};
