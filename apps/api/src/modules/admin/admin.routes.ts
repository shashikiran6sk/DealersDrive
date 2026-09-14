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

/**
 * D1–D15. Every write in this router is audit-logged with the admin identity.
 *
 * This router deliberately carries **no** `requirePermission` middleware, and
 * that is worth being explicit about rather than reading as an omission. An
 * admin action's permission is checked inside `admin.service.ts`, in the same
 * function that performs it. Putting the check there rather than here means it
 * cannot be bypassed by a second caller reaching the service another way, and it
 * keeps the permission next to the audit row it justifies.
 *
 * ── Reconstruction slice ────────────────────────────────────────────────────
 * The baseline declares 20 routes. F049 mounted the first, which is also the one
 * the console shell reads on every page, and F044 the two KYC review paths.
 * **F045 brings the six dealer paths** — bar `POST /dealers/:id/credits/grant`,
 * which moves credits and so waits for the ledger at F050/F054. The listing
 * queue, payments, configuration and the audit log belong to later tiers.
 * ────────────────────────────────────────────────────────────────────────────
 */
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
