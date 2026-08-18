import type { Request, RequestHandler } from 'express';

import type {
  AdminPrincipal,
  DealerPrincipal,
  PendingPrincipal,
  SessionResolver,
} from '../modules/auth/session.port.js';
import { ForbiddenError, UnauthorizedError } from '../platform/errors.js';
import { setContextValue } from './request-context.js';

/**
 * The middleware order IS the security model (ARCHITECTURE §5.4).
 *
 *   requireDealer  → puts a real dealerId into the request context
 *   requireDealerActive → refuses anything a suspended dealer may not do
 *   requirePermission   → checks capability
 *   …then the service re-checks ownership inside the transaction that writes.
 *
 * Both checks, always. The guard is never the only check, so there is no
 * TOCTOU gap between "you may" and "this row is yours" (§8.3).
 */
export function createAuthMiddleware(sessions: SessionResolver) {
  /** Resolves the dealer and writes it into the request. Nothing else may. */
  const requireDealer: RequestHandler = (req, _res, next) => {
    void (async () => {
      try {
        const principal = await sessions.resolveDealer(req);
        if (!principal) throw new UnauthorizedError();
        req.principal = principal;
        setContextValue('userId', principal.userId);
        setContextValue('dealerId', principal.dealerId);
        next();
      } catch (error) {
        next(error);
      }
    })();
  };

  /**
   * Signed in, dealership or not. The guard for the three routes that exist
   * *because* a dealership does not: `GET /v1/auth/me`, `POST
   * /v1/auth/onboarding` and `POST /v1/auth/logout`.
   */
  const requireSignedIn: RequestHandler = (req, _res, next) => {
    void (async () => {
      try {
        const principal = await sessions.resolveSignedIn(req);
        if (!principal) throw new UnauthorizedError();
        req.principal = principal;
        setContextValue('userId', principal.userId);
        if (principal.kind === 'DEALER') setContextValue('dealerId', principal.dealerId);
        next();
      } catch (error) {
        next(error);
      }
    })();
  };

  const requireAdmin: RequestHandler = (req, _res, next) => {
    void (async () => {
      try {
        const principal = await sessions.resolveAdmin(req);
        if (!principal) throw new UnauthorizedError('Sign in to the admin console to do that.');
        req.principal = principal;
        setContextValue('userId', principal.userId);
        next();
      } catch (error) {
        next(error);
      }
    })();
  };

  return { requireDealer, requireSignedIn, requireAdmin };
}

/**
 * A dealer who is not ACTIVE can still read their own console — they need to
 * see why — but cannot publish anything (API-SPEC C11 `DEALER_NOT_ACTIVE`).
 */
export const requireDealerActive: RequestHandler = (req, _res, next) => {
  const principal = dealerPrincipal(req);
  if (principal.dealerStatus !== 'ACTIVE') {
    next(
      new ForbiddenError(
        'Your dealership is not active yet. Listings can be published once our team approves it.',
        { code: 'DEALER_NOT_ACTIVE' },
      ),
    );
    return;
  }
  next();
};

export function requirePermission(permission: string): RequestHandler {
  return (req, _res, next) => {
    const principal = req.principal;
    if (!principal) {
      next(new UnauthorizedError());
      return;
    }
    if (!principal.permissions.includes(permission)) {
      next(new ForbiddenError(`This action needs the ${permission} permission.`));
      return;
    }
    next();
  };
}

/**
 * Typed read of the resolved principal. Throws if a route forgot its guard —
 * a programmer error, and one that must never degrade into "no tenant filter".
 */
export function dealerPrincipal(req: Request): DealerPrincipal {
  const principal = req.principal;
  if (!principal || principal.kind !== 'DEALER') {
    throw new Error('dealerPrincipal() without requireDealer on the route.');
  }
  return principal;
}

/** The signed-in person, dealership or not. Throws if `requireSignedIn` is missing. */
export function signedInPrincipal(req: Request): DealerPrincipal | PendingPrincipal {
  const principal = req.principal;
  if (!principal || (principal.kind !== 'DEALER' && principal.kind !== 'PENDING')) {
    throw new Error('signedInPrincipal() without requireSignedIn on the route.');
  }
  return principal;
}

export function adminPrincipal(req: Request): AdminPrincipal {
  const principal = req.principal;
  if (!principal || principal.kind !== 'ADMIN') {
    throw new Error('adminPrincipal() without requireAdmin on the route.');
  }
  return principal;
}
