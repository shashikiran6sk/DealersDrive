import { StorefrontIntentInput } from '@dealers-drive/contracts';

import { validate, validated } from '../../../middleware/validate.js';
import { handle } from './handle.js';
import type { StorefrontRoute } from './route.js';

export const postIntent: StorefrontRoute = (router, { service, rateLimit }) => {
  router.post(
    '/storefront/enquiry-intent',
    rateLimit('storefront.intent', { limit: 30, windowSeconds: 3600, failClosed: true }),
    validate({ body: StorefrontIntentInput }),
    handle(async (req, res) => {
      res.json(
        await service.intent(
          service.hostname(req),
          validated<StorefrontIntentInput>(req, 'body').listingSlug,
        ),
      );
    }),
  );
};
