import { Router } from 'express';

import type { RateLimiter } from '../../middleware/rate-limit.js';
import type { AuthService } from './auth.service.js';
import type { CustomerAuthService } from './customer-auth.service.js';
import type { PhoneService } from './phone.service.js';
import type { PhoneSignInService } from './phone-sign-in.service.js';
import { getAdminGoogleStart } from './routes/get-admin-google-start.js';
import { getCustomerMe } from './routes/get-customer-me.js';
import { postSignInPhoneCustomer } from './routes/post-sign-in-phone-customer.js';
import { postSignUpCustomer } from './routes/post-sign-up-customer.js';
import { postCustomerLogout } from './routes/post-customer-logout.js';
import { getGoogleCallback } from './routes/get-google-callback.js';
import { getGoogleLinkStart } from './routes/get-google-link-start.js';
import { getGoogleStart } from './routes/get-google-start.js';
import { getMe } from './routes/get-me.js';
import { getPhoneWidget } from './routes/get-phone-widget.js';
import { getProviders } from './routes/get-providers.js';
import { getSignInPhoneWidget } from './routes/get-sign-in-phone-widget.js';
import { postAdminLogout } from './routes/post-admin-logout.js';
import { postLogout } from './routes/post-logout.js';
import { postOnboarding } from './routes/post-onboarding.js';
import { postPhoneAvailability } from './routes/post-phone-availability.js';
import { postPhoneVerify } from './routes/post-phone-verify.js';
import { postSignInPhoneDealer } from './routes/post-sign-in-phone-dealer.js';
import { getWorkspaces } from './routes/get-workspaces.js';
import { putWorkspace } from './routes/put-workspace.js';
import type {
  CustomerAuthRoute,
  PublicAuthRoute,
  SessionAuthRoute,
  WorkspaceRoute,
} from './routes/route.js';
import type { WorkspaceService } from './workspace.service.js';

const PUBLIC_ROUTES: PublicAuthRoute[] = [
  getProviders,
  getGoogleStart,
  getAdminGoogleStart,
  getGoogleCallback,
  postAdminLogout,
  getSignInPhoneWidget,
  postSignInPhoneDealer,
  postSignInPhoneCustomer,
  postSignUpCustomer,
  postCustomerLogout,
];

export function createPublicAuthRouter(
  service: AuthService,
  phoneSignIn: PhoneSignInService,
  customers: CustomerAuthService,
  rateLimit: RateLimiter,
): Router {
  const router = Router();
  for (const route of PUBLIC_ROUTES) route(router, { service, phoneSignIn, customers, rateLimit });
  return router;
}

const CUSTOMER_ROUTES: CustomerAuthRoute[] = [getCustomerMe];

export function createCustomerAuthRouter(customers: CustomerAuthService): Router {
  const router = Router();
  for (const route of CUSTOMER_ROUTES) route(router, { customers });
  return router;
}

const WORKSPACE_ROUTES: WorkspaceRoute[] = [getWorkspaces, putWorkspace];

export function createWorkspacesRouter(workspaces: WorkspaceService): Router {
  const router = Router();
  for (const route of WORKSPACE_ROUTES) route(router, { workspaces });
  return router;
}

const SESSION_ROUTES: SessionAuthRoute[] = [
  getMe,
  getGoogleLinkStart,
  postOnboarding,
  getPhoneWidget,
  postPhoneAvailability,
  postPhoneVerify,
  postLogout,
];

export function createSessionAuthRouter(
  service: AuthService,
  phone: PhoneService,
  rateLimit: RateLimiter,
): Router {
  const router = Router();
  for (const route of SESSION_ROUTES) route(router, { service, phone, rateLimit });
  return router;
}
