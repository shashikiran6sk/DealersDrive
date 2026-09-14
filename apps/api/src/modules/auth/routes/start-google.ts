import type { Request, Response, NextFunction } from 'express';

import { setOAuthCookie } from '../session.cookie.js';
import type { AuthService } from '../auth.service.js';
import type { OAuthAudience } from '../oauth-transaction.js';

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
