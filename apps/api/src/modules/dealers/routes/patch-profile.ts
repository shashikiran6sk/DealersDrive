import {
  DealerSelfUpdateInput,
  type DealerSelfUpdateInput as DealerSelfUpdateInputType,
} from '@dealers-drive/contracts';

import { dealerPrincipal, requirePermission } from '../../../middleware/auth.js';
import { validate, validated } from '../../../middleware/validate.js';

import { type DealersRoute } from './route.js';

/**
 * C2 — the dealership editing itself, after onboarding is over (**R27**),
 * with two of the three fields held for review (**R34**).
 *
 * `DealerSelfUpdateInput`, not `UpdateDealerInput`. The difference is the
 * whole of a dealer's authority over their own record: the year they started,
 * the line they describe themselves in, and what their yard does. The
 * registered name, the address, the town, the pin, the mobile and the email
 * are absent from that schema, so sending one is a 400 that names the field
 * rather than a silent write — see the schema for why each of them is
 * evidence rather than a preference.
 *
 * **This is a 200 either way, and that is deliberate.** On an ACTIVE
 * dealership the tagline and the service list do not reach the dealership row
 * — they become a `DealerProfileChange` a moderator decides on — but the save
 * *succeeded*: the dealer's edit was accepted and recorded. A 202 would be
 * more literally accurate about the queue and would tell a browser the wrong
 * thing about the response body, which is the dealership as it stands now,
 * with `profileChange` on it saying what is waiting. The screen reads that
 * field rather than the status code.
 *
 * `selfUpdate` rather than `update`, and the second argument is why: the
 * queue records *who* typed the words, not only which dealership they belong
 * to. `dealerId` still comes from the session and never from the body
 * (rule 1); so does the user id.
 *
 * The admin console keeps the full shape at
 * `PATCH /v1/admin/dealers/:id`, and a dealership still answering the
 * onboarding questions keeps it at `PATCH /v1/dealer/onboarding` below.
 */
export const patchProfile: DealersRoute = (router, service) => {
  router.patch(
    '/',
    requirePermission('dealer:update'),
    validate({ body: DealerSelfUpdateInput }),
    (req, res, next) => {
      void (async () => {
        try {
          const { dealerId, userId } = dealerPrincipal(req);
          const body = validated<DealerSelfUpdateInputType>(req, 'body');
          res.json(await service.selfUpdate(dealerId, userId, body));
        } catch (error) {
          next(error);
        }
      })();
    },
  );
};
