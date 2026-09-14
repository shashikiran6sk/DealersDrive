import type { RouteRegistrar } from '../../../http/route.js';
import type { RateLimiter } from '../../../middleware/rate-limit.js';
import type { AuthService } from '../auth.service.js';
import type { PhoneService } from '../phone.service.js';

export interface PublicAuthDeps {
  service: AuthService;
}

export interface SessionAuthDeps {
  service: AuthService;
  phone: PhoneService;
  rateLimit: RateLimiter;
}

export type PublicAuthRoute = RouteRegistrar<PublicAuthDeps>;
export type SessionAuthRoute = RouteRegistrar<SessionAuthDeps>;
