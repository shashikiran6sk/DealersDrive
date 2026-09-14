import { OnboardingInput } from '@dealers-drive/contracts';

import { ForbiddenError } from '../../../platform/errors.js';
import { signedInPrincipal } from '../../../middleware/auth.js';
import { validate, validated } from '../../../middleware/validate.js';

import type { SessionAuthRoute } from './route.js';

export const postOnboarding: SessionAuthRoute = (router, { service }) => {
  router.post('/onboarding', validate({ body: OnboardingInput }), (req, res, next) => {
    void (async () => {
      try {
        const principal = signedInPrincipal(req);
        if (principal.kind !== 'PENDING') {
          throw new ForbiddenError('This account already manages a dealership.', {
            code: 'DEALER_ALREADY_EXISTS',
          });
        }

        const body = validated<OnboardingInput>(req, 'body');
        res.status(201).json(await service.onboard(principal, body));
      } catch (error) {
        next(error);
      }
    })();
  });
};
