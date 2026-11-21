import { rawBodyOf } from '../../../middleware/raw-body.js';

import { handle, type BillingRoute } from './route.js';

export const postWebhookRazorpay: BillingRoute = (router, service) => {
  router.post(
    '/webhooks/razorpay',
    handle((req) =>
      service.webhook({
        rawBody: rawBodyOf(req),
        signature: req.get('x-razorpay-signature'),
        eventId: req.get('x-razorpay-event-id'),
        body: req.body,
      }),
    ),
  );
};
