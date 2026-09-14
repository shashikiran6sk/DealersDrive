import {
  IdParam,
  ReasonInput,
  type IdParam as IdParamType,
  type ReasonInput as ReasonInputType,
} from '@dealers-drive/contracts';

import { adminPrincipal } from '../../../middleware/auth.js';
import { validate, validated } from '../../../middleware/validate.js';

import { handle, type AdminRoute } from './route.js';

/**
 * `ReasonInput`, shared with the dealer and document rejections, and not a
 * coincidence: all three are refusals a person reads verbatim, and all three are
 * worse than useless without a sentence.
 */
export const postProfileChangeReject: AdminRoute = (router, service) => {
  router.post(
    '/profile-changes/:id/reject',
    validate({ params: IdParam, body: ReasonInput }),
    handle((req) =>
      service.rejectProfileChange(
        adminPrincipal(req),
        validated<IdParamType>(req, 'params').id,
        validated<ReasonInputType>(req, 'body').reason,
      ),
    ),
  );
};
