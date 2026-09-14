import type { Request, RequestHandler } from 'express';

import type {
  AdminPrincipal,
  DealerPrincipal,
  PendingPrincipal,
  SessionResolver,
} from '../modules/auth/session.port.js';
import { ForbiddenError, UnauthorizedError } from '../platform/errors.js';
import { setContextValue } from './request-context.js';

export function createAuthMiddleware(sessions: SessionResolver) {
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

export function dealerPrincipal(req: Request): DealerPrincipal {
  const principal = req.principal;
  if (!principal || principal.kind !== 'DEALER') {
    throw new Error('dealerPrincipal() without requireDealer on the route.');
  }
  return principal;
}

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
