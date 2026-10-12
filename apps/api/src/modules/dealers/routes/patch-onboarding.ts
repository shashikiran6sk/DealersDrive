import { DealerOnboardingInput } from '@dealers-drive/contracts';

import { dealerPrincipal, requirePermission } from '../../../middleware/auth.js';
import { validate, validated } from '../../../middleware/validate.js';

import { type DealersRoute } from './route.js';

export const patchOnboarding: DealersRoute = (router, service) => {
  router.patch(
    '/onboarding',
    requirePermission('dealer:update'),
    validate({ body: DealerOnboardingInput }),
    (req, res, next) => {
      void (async () => {
        try {
          const { dealerId } = dealerPrincipal(req);
          const body = validated<DealerOnboardingInput>(req, 'body');
          res.json(await service.amendDraft(dealerId, body));
        } catch (error) {
          next(error);
        }
      })();
    },
  );
};
