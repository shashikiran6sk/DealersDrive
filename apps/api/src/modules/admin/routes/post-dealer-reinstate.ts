import {
  IdParam,
  NoteInput,
  type IdParam as IdParamType,
  type NoteInput as NoteInputType,
} from '@dealers-drive/contracts';

import { adminPrincipal } from '../../../middleware/auth.js';
import { validate, validated } from '../../../middleware/validate.js';

import { handle, type AdminRoute } from './route.js';

export const postDealerReinstate: AdminRoute = (router, service) => {
  router.post(
    '/dealers/:id/reinstate',
    validate({ params: IdParam, body: NoteInput }),
    handle((req) =>
      service.reinstateDealer(
        adminPrincipal(req),
        validated<IdParamType>(req, 'params').id,
        validated<NoteInputType>(req, 'body').note,
      ),
    ),
  );
};
