import { Router } from 'express';

import type { RateLimiter } from '../../middleware/rate-limit.js';
import type { AuthService } from './auth.service.js';
import type { PhoneService } from './phone.service.js';
import { getAdminGoogleStart } from './routes/get-admin-google-start.js';
import { getGoogleCallback } from './routes/get-google-callback.js';
import { getGoogleStart } from './routes/get-google-start.js';
import { getMe } from './routes/get-me.js';
import { getPhoneWidget } from './routes/get-phone-widget.js';
import { getProviders } from './routes/get-providers.js';
import { postAdminLogout } from './routes/post-admin-logout.js';
import { postLogout } from './routes/post-logout.js';
import { postOnboarding } from './routes/post-onboarding.js';
import { postPhoneAvailability } from './routes/post-phone-availability.js';
import { postPhoneVerify } from './routes/post-phone-verify.js';
import type { PublicAuthRoute, SessionAuthRoute } from './routes/route.js';

const PUBLIC_ROUTES: PublicAuthRoute[] = [
  getProviders,
  getGoogleStart,
  getAdminGoogleStart,
  getGoogleCallback,
  postAdminLogout,
];

export function createPublicAuthRouter(service: AuthService): Router {
  const router = Router();
  for (const route of PUBLIC_ROUTES) route(router, { service });
  return router;
}

const SESSION_ROUTES: SessionAuthRoute[] = [
  getMe,
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
