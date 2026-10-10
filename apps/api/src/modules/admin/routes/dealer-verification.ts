import {
  DealerVerificationDecisionInput,
  IdParam,
  type DealerVerificationDecisionInput as Decision,
  type IdParam as Id,
} from '@dealers-drive/contracts';
import { adminPrincipal } from '../../../middleware/auth.js';
import { validate, validated } from '../../../middleware/validate.js';
import { handle, type AdminRoute } from './route.js';

export const dealerVerification: AdminRoute = (router, service) => {
  router.get(
    '/dealers/:id/verification',
    validate({ params: IdParam }),
    handle((req) =>
      service.verification.review(adminPrincipal(req), validated<Id>(req, 'params').id),
    ),
  );
  router.post(
    '/dealers/:id/verification',
    validate({ params: IdParam, body: DealerVerificationDecisionInput }),
    handle((req) =>
      service.verification.decide(
        adminPrincipal(req),
        validated<Id>(req, 'params').id,
        validated<Decision>(req, 'body'),
      ),
    ),
  );
};
