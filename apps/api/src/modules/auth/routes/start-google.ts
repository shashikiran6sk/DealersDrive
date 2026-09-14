import type { Request, Response, NextFunction } from 'express';

import { setOAuthCookie } from '../session.cookie.js';
import type { AuthService } from '../auth.service.js';
import type { OAuthAudience } from '../oauth-transaction.js';

/**
 * `/google/start` and `/admin/google/start` are the same handler with one value
 * changed, and that value is the only difference between the two consoles'
 * sign-ins: it is sealed into the transaction cookie and decides the scope of the
 * session the callback issues.
 */
export function startGoogle(service: AuthService, audience: OAuthAudience) {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      const returnTo = typeof req.query.returnTo === 'string' ? req.query.returnTo : undefined;
      const { authorizationUrl, cookie, maxAgeSeconds } = service.startGoogle(returnTo, audience);

      setOAuthCookie(res, cookie, maxAgeSeconds);
      res.redirect(302, authorizationUrl);
    } catch (error) {
      next(error);
    }
  };
}
