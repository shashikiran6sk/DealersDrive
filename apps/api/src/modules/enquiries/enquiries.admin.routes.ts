import { Router } from 'express';

import type { AdminEnquiriesService } from './enquiries.admin.service.js';
import type { AdminEnquiriesRoute } from './routes/admin-route.js';
import { getAdminEnquiries } from './routes/get-admin-enquiries.js';
import { getAdminEnquiry } from './routes/get-admin-enquiry.js';

const ROUTES: AdminEnquiriesRoute[] = [getAdminEnquiries, getAdminEnquiry];

export function createAdminEnquiriesRouter(service: AdminEnquiriesService): Router {
  const router = Router();
  for (const route of ROUTES) route(router, service);
  return router;
}
