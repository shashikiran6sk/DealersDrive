import {
  UpdateDealerInput,
  type UpdateDealerInput as UpdateDealerInputType,
} from '@dealers-drive/contracts';

import { dealerPrincipal, requirePermission } from '../../../middleware/auth.js';
import { validate, validated } from '../../../middleware/validate.js';

import { type DealersRoute } from './route.js';

/**
 * C2b — the same dealership, while it is still a DRAFT (**R27**).
 *
 * The onboarding wizard's Back button leads to steps 1 and 2, and those steps
 * ask for exactly the fields the profile screen may no longer touch. That is
 * not a contradiction: a DRAFT dealership is one that is still *answering*
 * these questions, or one a moderator has sent back to fix an answer. Nothing
 * has been verified about it yet, so there is nothing an edit can invalidate.
 *
 * The whole of the difference between this route and the one above is the
 * status guard in `amendDraft`, and it is a guard rather than a permission:
 * `dealer:update` is the same permission both routes need, and the question
 * here is not who is holding the pen but whether the record has been checked
 * yet.
 */
export const patchOnboarding: DealersRoute = (router, service) => {
  router.patch(
    '/onboarding',
    requirePermission('dealer:update'),
    validate({ body: UpdateDealerInput }),
    (req, res, next) => {
      void (async () => {
        try {
          const { dealerId } = dealerPrincipal(req);
          const body = validated<UpdateDealerInputType>(req, 'body');
          res.json(await service.amendDraft(dealerId, body));
        } catch (error) {
          next(error);
        }
      })();
    },
  );
};
