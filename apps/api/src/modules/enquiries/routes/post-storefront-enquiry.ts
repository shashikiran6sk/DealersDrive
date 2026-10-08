import { CreateStorefrontEnquiryInput } from '@dealers-drive/contracts';

import { customerPrincipal } from '../../../middleware/auth.js';
import { validate, validated } from '../../../middleware/validate.js';
import { byCustomer } from './by-customer.js';
import type { EnquiriesRoute } from './route.js';

export const postStorefrontEnquiry: EnquiriesRoute = (
  router,
  { service, rateLimit, storefront },
) => {
  router.post(
    '/storefront',
    rateLimit('enquiries.create.customer', {
      limit: 10,
      windowSeconds: 3600,
      keyBy: byCustomer,
      failClosed: true,
    }),
    rateLimit('enquiries.create.ip', { limit: 30, windowSeconds: 3600, failClosed: true }),
    validate({ body: CreateStorefrontEnquiryInput }),
    (req, res, next) => {
      res.set('Cache-Control', 'no-store');
      void (async () => {
        const input = validated<CreateStorefrontEnquiryInput>(req, 'body');
        const origin = await storefront.origin(input.ticket);
        const receipt = await service.create(
          customerPrincipal(req),
          { listingSlug: origin.listingSlug, message: input.message },
          origin,
        );
        res.status(201).json(receipt);
      })().catch(next);
    },
  );
};
