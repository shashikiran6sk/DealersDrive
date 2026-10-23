import {
  RevealContactInput,
  VehicleSlugParam,
  type VehicleSlugParam as VehicleSlugParamType,
} from '@dealers-drive/contracts';

import { customerPrincipal } from '../../../middleware/auth.js';
import { validate, validated } from '../../../middleware/validate.js';
import type { ContactRevealRoute } from '../contact-reveals.routes.js';
import { CONTACT_RATE_LIMITED } from '../enquiries.messages.js';
import { byCustomer } from './by-customer.js';

export const postRevealContact: ContactRevealRoute = (
  router,
  { service, rateLimit, requireCustomer },
) => {
  router.post(
    '/vehicles/:slug/reveal-contact',
    requireCustomer,
    rateLimit('contact.reveal.customer', {
      limit: 10,
      windowSeconds: 3600,
      keyBy: byCustomer,
      code: 'CONTACT_RATE_LIMITED',
      message: CONTACT_RATE_LIMITED,
    }),
    rateLimit('contact.reveal.ip', {
      limit: 30,
      windowSeconds: 3600,
      code: 'CONTACT_RATE_LIMITED',
      message: CONTACT_RATE_LIMITED,
    }),
    validate({ params: VehicleSlugParam, body: RevealContactInput }),
    (req, res, next) => {
      void (async () => {
        try {
          const { slug } = validated<VehicleSlugParamType>(req, 'params');
          res.set('Cache-Control', 'no-store');
          res.json(await service.revealContact(customerPrincipal(req), slug));
        } catch (error) {
          next(error);
        }
      })();
    },
  );
};
