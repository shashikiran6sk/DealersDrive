import { StorefrontIntentParam } from '@dealers-drive/contracts';

import { validate, validated } from '../../../middleware/validate.js';
import { handle } from './handle.js';
import type { StorefrontRoute } from './route.js';

export const getIntent: StorefrontRoute = (router, { service, rateLimit }) => {
  router.get(
    '/storefront/enquiry-intent/:ticket',
    rateLimit('storefront.intent.read', { limit: 120, windowSeconds: 3600 }),
    validate({ params: StorefrontIntentParam }),
    handle(async (req, res) => {
      res.json(
        (await service.origin(validated<StorefrontIntentParam>(req, 'params').ticket)).context,
      );
    }),
  );
};
