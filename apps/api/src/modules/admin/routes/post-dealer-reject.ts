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
 * The two refusals, and they are different verbs on purpose. `reject` destroys
 * the application — storage, documents, membership and the dealership row.
 * `request-changes` keeps every byte of it and hands it back to the dealer to
 * correct. Both take the same body, because the dealer reads the reason verbatim
 * either way; only one of them is reversible.
 */
export const postDealerReject: AdminRoute = (router, service) => {
  router.post(
    '/dealers/:id/reject',
    validate({ params: IdParam, body: ReasonInput }),
    handle((req) =>
      service.rejectDealer(
        adminPrincipal(req),
        validated<IdParamType>(req, 'params').id,
        validated<ReasonInputType>(req, 'body').reason,
      ),
    ),
  );
};
