import { CreateEnquiryInput } from '@dealers-drive/contracts';

import { customerPrincipal } from '../../../middleware/auth.js';
import { validate, validated } from '../../../middleware/validate.js';
import { ENQUIRY_RATE_LIMITED } from '../enquiries.messages.js';

import type { EnquiriesRoute } from './route.js';
import { byCustomer } from './by-customer.js';

export const postEnquiry: EnquiriesRoute = (router, { service, rateLimit }) => {
  router.post(
    '/',
    rateLimit('enquiries.create.customer', {
      limit: 10,
      windowSeconds: 3600,
      keyBy: byCustomer,
      code: 'ENQUIRY_RATE_LIMITED',
      message: ENQUIRY_RATE_LIMITED,
    }),
    rateLimit('enquiries.create.ip', {
      limit: 30,
      windowSeconds: 3600,
      code: 'ENQUIRY_RATE_LIMITED',
      message: ENQUIRY_RATE_LIMITED,
    }),
    validate({ body: CreateEnquiryInput }),
    (req, res, next) => {
      void (async () => {
        try {
          const receipt = await service.create(
            customerPrincipal(req),
            validated<CreateEnquiryInput>(req, 'body'),
          );
          res.set('Cache-Control', 'no-store');
          res.status(201).json(receipt);
        } catch (error) {
          next(error);
        }
      })();
    },
  );
};
