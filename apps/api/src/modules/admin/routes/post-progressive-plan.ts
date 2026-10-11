import {
  IdParam,
  ProgressivePlanInput,
  type IdParam as Id,
  type ProgressivePlanInput as Plan,
} from '@dealers-drive/contracts';
import { adminPrincipal } from '../../../middleware/auth.js';
import { validate, validated } from '../../../middleware/validate.js';
import { handle, type AdminRoute } from './route.js';
export const postProgressivePlan: AdminRoute = (router, service) => {
  router.put(
    '/dealers/:id/progressive-plan',
    validate({ params: IdParam, body: ProgressivePlanInput }),
    handle((req) =>
      service.progressive.decide(
        adminPrincipal(req),
        validated<Id>(req, 'params').id,
        validated<Plan>(req, 'body'),
      ),
    ),
  );
};
