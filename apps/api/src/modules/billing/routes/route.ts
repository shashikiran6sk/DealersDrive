import type { RouteRegistrar } from '../../../http/route.js';
import type { BillingService } from '../billing.service.js';

export type BillingRoute = RouteRegistrar<BillingService>;

export { handle } from './handle.js';
