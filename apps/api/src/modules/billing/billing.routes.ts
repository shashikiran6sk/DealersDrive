import { Router } from 'express';

import type { BillingService } from './billing.service.js';
import { getAdminDealerCredits } from './routes/get-admin-dealer-credits.js';
import { getBillingLedger } from './routes/get-billing-ledger.js';
import { getBillingOrders } from './routes/get-billing-orders.js';
import { getBillingPacks } from './routes/get-billing-packs.js';
import { getBillingSummary } from './routes/get-billing-summary.js';
import { postAdminDealerCredits } from './routes/post-admin-dealer-credits.js';
import { postBillingOrder } from './routes/post-billing-order.js';
import { postBillingOrderVerify } from './routes/post-billing-order-verify.js';
import { postWebhookRazorpay } from './routes/post-webhook-razorpay.js';
import type { BillingRoute } from './routes/route.js';

const DEALER_ROUTES: BillingRoute[] = [
  getBillingSummary,
  getBillingPacks,
  getBillingLedger,
  getBillingOrders,
  postBillingOrder,
  postBillingOrderVerify,
];

const WEBHOOK_ROUTES: BillingRoute[] = [postWebhookRazorpay];

const ADMIN_ROUTES: BillingRoute[] = [getAdminDealerCredits, postAdminDealerCredits];

function mount(routes: BillingRoute[], service: BillingService): Router {
  const router = Router();
  for (const route of routes) route(router, service);
  return router;
}

export function createBillingRouter(service: BillingService): Router {
  return mount(DEALER_ROUTES, service);
}

export function createBillingWebhookRouter(service: BillingService): Router {
  return mount(WEBHOOK_ROUTES, service);
}

export function createAdminBillingRouter(service: BillingService): Router {
  return mount(ADMIN_ROUTES, service);
}
