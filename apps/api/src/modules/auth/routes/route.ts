import type { RouteRegistrar } from '../../../http/route.js';
import type { RateLimiter } from '../../../middleware/rate-limit.js';
import type { AuthService } from '../auth.service.js';
import type { CustomerAuthService } from '../customer-auth.service.js';
import type { PhoneService } from '../phone.service.js';
import type { PhoneSignInService } from '../phone-sign-in.service.js';
import type { WorkspaceService } from '../workspace.service.js';

export interface PublicAuthDeps {
  service: AuthService;
  phoneSignIn: PhoneSignInService;
  customers: CustomerAuthService;
  rateLimit: RateLimiter;
}

export interface CustomerAuthDeps {
  customers: CustomerAuthService;
}

export interface SessionAuthDeps {
  service: AuthService;
  phone: PhoneService;
  rateLimit: RateLimiter;
}

export interface WorkspaceDeps {
  workspaces: WorkspaceService;
}

export type PublicAuthRoute = RouteRegistrar<PublicAuthDeps>;
export type SessionAuthRoute = RouteRegistrar<SessionAuthDeps>;
export type CustomerAuthRoute = RouteRegistrar<CustomerAuthDeps>;
export type WorkspaceRoute = RouteRegistrar<WorkspaceDeps>;
