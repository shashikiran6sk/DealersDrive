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

/**
 * PART B — the only routes that may be reached without a session.
 *
 * Three of them are browser navigations rather than API calls:
 * `/google/start`, `/admin/google/start` and the one `/google/callback` they
 * both come back through. They answer with a 302 because they are steps in a
 * redirect flow the browser is driving; everything else here is ordinary JSON.
 *
 * **One callback, two consoles.** Google requires every redirect URI to be
 * registered against the OAuth client, so a second callback path would be a
 * second thing to register and a second thing to get wrong in an environment.
 * Which console a round trip belongs to travels in the sealed `dd_oauth`
 * cookie instead — see `OAuthAudience`.
 *
 * There is no `POST /admin/login` any more. Admin sign-in is this same Google
 * flow, and the address it produces is checked against `ADMIN_ALLOWLIST`; the
 * API holds no password to verify and no rate limiter guarding one.
 *
 * The callback never renders an error itself. A failed sign-in sends the person
 * back to the sign-in screen with a code in the query string, so they see the
 * product's own error state rather than a JSON body in an address bar.
 */
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

/**
 * B4–B8 — the routes behind `requireSignedIn`: a verified identity, with or
 * without a dealership.
 *
 * The two phone routes are here rather than on the public router, and that is
 * a deliberate spend control (**R39**). MSG91's widget sends the SMS from the
 * browser, so whoever holds `widgetId` and `tokenAuth` can spend the account's
 * balance — which makes "who may read them" the only gate the API still owns.
 * Behind a session that gate is the set of people who have completed a Google
 * sign-in; on `GET /v1/config/public` it would have been the internet, and
 * that response is additionally `Cache-Control: public`.
 */
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
