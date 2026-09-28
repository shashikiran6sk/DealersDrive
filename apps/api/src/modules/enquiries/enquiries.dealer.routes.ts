import { Router } from 'express';

import type { EnquiriesService } from './enquiries.service.js';
import type { DealerEnquiriesRoute } from './routes/dealer-route.js';
import { getDealerEnquiries } from './routes/get-dealer-enquiries.js';
import { getDealerEnquiryCounts } from './routes/get-dealer-enquiry-counts.js';
import { patchDealerEnquiry } from './routes/patch-dealer-enquiry.js';

const ROUTES: DealerEnquiriesRoute[] = [
  getDealerEnquiries,
  getDealerEnquiryCounts,
  patchDealerEnquiry,
];

export function createDealerEnquiriesRouter(service: EnquiriesService): Router {
  const router = Router();
  for (const route of ROUTES) route(router, service);
  return router;
}
