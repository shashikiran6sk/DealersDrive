import { DealerSubmitInput } from '@dealers-drive/contracts';
import { validate, validated } from '../../../middleware/validate.js';
import { dealerPrincipal, requirePermission } from '../../../middleware/auth.js';

import { type DealersRoute } from './route.js';

export const postSubmit: DealersRoute = (router, service) => {
  router.post(
    '/submit',
    requirePermission('dealer:update'),
    validate({ body: DealerSubmitInput.optional().default({}) }),
    (req, res, next) => {
      void (async () => {
        try {
          const { dealerId, userId } = dealerPrincipal(req);
          res.json(
            await service.submitForVerification(
              dealerId,
              { type: 'DEALER', id: userId },
              validated<DealerSubmitInput>(req, 'body'),
            ),
          );
        } catch (error) {
          next(error);
        }
      })();
    },
  );
};
