import { Router } from 'express';

import type { AdminService } from './admin.service.js';
import { deleteAccess } from './routes/delete-access.js';
import { getAccess } from './routes/get-access.js';
import { getConfig } from './routes/get-config.js';
import { getDealer } from './routes/get-dealer.js';
import { getDealers } from './routes/get-dealers.js';
import { getMetricsOverview } from './routes/get-metrics-overview.js';
import { getProfileChanges } from './routes/get-profile-changes.js';
import { patchDealer } from './routes/patch-dealer.js';
import { postAccess } from './routes/post-access.js';
import { postDealerApprove } from './routes/post-dealer-approve.js';
import { postDealerReinstate } from './routes/post-dealer-reinstate.js';
import { postDealerReject } from './routes/post-dealer-reject.js';
import { postDealerRequestChanges } from './routes/post-dealer-request-changes.js';
import { postDealerSuspend } from './routes/post-dealer-suspend.js';
import { postDocumentReject } from './routes/post-document-reject.js';
import { postDocumentVerify } from './routes/post-document-verify.js';
import { postProfileChangeApprove } from './routes/post-profile-change-approve.js';
import { postProfileChangeReject } from './routes/post-profile-change-reject.js';
import { putConfigKey } from './routes/put-config-key.js';
import type { AdminRoute } from './routes/route.js';

const ROUTES: AdminRoute[] = [
  getMetricsOverview,
  getDealers,
  getDealer,
  postDealerApprove,
  patchDealer,
  postDealerReject,
  postDealerRequestChanges,
  postDealerSuspend,
  postDealerReinstate,
  getProfileChanges,
  postProfileChangeApprove,
  postProfileChangeReject,
  postDocumentVerify,
  postDocumentReject,
  getConfig,
  putConfigKey,
  getAccess,
  postAccess,
  deleteAccess,
];

export function createAdminRouter(service: AdminService): Router {
  const router = Router();
  for (const route of ROUTES) route(router, service);
  return router;
}
