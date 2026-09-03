import { AdminLoginInput, OnboardingInput } from '@dealers-drive/contracts';
import { Router } from 'express';

import { env } from '../../config/env.js';
import { signedInPrincipal } from '../../middleware/auth.js';
import type { RateLimiter } from '../../middleware/rate-limit.js';
import { validate, validated } from '../../middleware/validate.js';
import { ForbiddenError } from '../../platform/errors.js';
import type { AuthService } from './auth.service.js';
import { ADMIN_LOGIN_LIMIT, ADMIN_LOGIN_WINDOW_SECONDS } from './auth.service.js';
import { openTransaction } from './oauth-transaction.js';
import {
  clearOAuthCookie,
  clearSessionCookie,
  readOAuthCookie,
  readSessionToken,
  setOAuthCookie,
  setSessionCookie,
} from './session.cookie.js';

/**
 * PART B — the only routes that may be reached without a session.
 *
 * Two of them are browser navigations rather than API calls: `/google/start`
 * and `/google/callback` answer with a 302, because they are steps in a
 * redirect flow the browser is driving. Everything else here is ordinary JSON.
 *
 * The callback never renders an error itself. A failed sign-in sends the person
 * back to the sign-in screen with a code in the query string, so they see the
 * product's own error state rather than a JSON body in an address bar.
 */
export function createPublicAuthRouter(service: AuthService, rateLimit: RateLimiter): Router {
  const router = Router();

  router.get('/providers', (_req, res) => {
    res.set('Cache-Control', 'no-store');
    res.json(service.providers());
  });

  router.get('/google/start', (req, res, next) => {
    try {
      const returnTo = typeof req.query.returnTo === 'string' ? req.query.returnTo : undefined;
      const { authorizationUrl, cookie, maxAgeSeconds } = service.startGoogle(returnTo);

      setOAuthCookie(res, cookie, maxAgeSeconds);
      res.redirect(302, authorizationUrl);
    } catch (error) {
      next(error);
    }
  });

  router.get('/google/callback', (req, res, next) => {
    void (async () => {
      const back = (code: string) =>
        res.redirect(302, `${env.WEB_BASE_URL}/dealer/login?error=${code}`);

      try {
        const transaction = openTransaction(readOAuthCookie(req));
        // Single-use, whatever happens next: the state and verifier inside are
        // spent the moment Google sends the browser back.
        clearOAuthCookie(res);

        // Google's own refusal — a closed account chooser, a denied consent.
        if (typeof req.query.error === 'string') {
          back('google_declined');
          return;
        }

        const code = typeof req.query.code === 'string' ? req.query.code : '';
        const state = typeof req.query.state === 'string' ? req.query.state : '';
        if (!code || !state) {
          back('invalid_callback');
          return;
        }

        const result = await service.completeGoogle({
          code,
          state,
          transaction,
          ip: req.ip,
          userAgent: req.get('user-agent'),
        });

        setSessionCookie(res, result.token, result.expiresAt);
        res.redirect(302, `${env.WEB_BASE_URL}${result.returnTo}`);
      } catch (error) {
        // A failed sign-in is a screen, not a JSON body — but a bug is still a
        // bug, so anything unexpected goes to the error handler.
        const code = (error as { code?: string }).code;
        if (code === 'OAUTH_STATE_INVALID' || code === 'OAUTH_EXCHANGE_FAILED') {
          back('sign_in_failed');
          return;
        }
        if (code === 'OAUTH_IDENTITY_INVALID') {
          back('identity_unverified');
          return;
        }
        if (code === 'ACCOUNT_LINK_REQUIRED') {
          back('account_link_required');
          return;
        }
        if (code === 'ACCOUNT_SUSPENDED') {
          back('account_suspended');
          return;
        }
        next(error);
      }
    })();
  });

  /**
   * B7. Rate-limited per email *and* per IP: the first stops one account being
   * ground through a password list, the second stops one host doing it across
   * many accounts.
   */
  router.post(
    '/admin/login',
    rateLimit('admin-login-ip', { limit: 20, windowSeconds: ADMIN_LOGIN_WINDOW_SECONDS }),
    validate({ body: AdminLoginInput }),
    rateLimit('admin-login-email', {
      limit: ADMIN_LOGIN_LIMIT,
      windowSeconds: ADMIN_LOGIN_WINDOW_SECONDS,
      keyBy: (req) => validated<AdminLoginInput>(req, 'body').email.trim().toLowerCase(),
      message: 'Too many sign-in attempts for that account. Try again in a few minutes.',
    }),
    (req, res, next) => {
      void (async () => {
        try {
          const body = validated<AdminLoginInput>(req, 'body');
          const result = await service.adminLogin({
            email: body.email,
            password: body.password,
            ip: req.ip,
            userAgent: req.get('user-agent'),
          });

          setSessionCookie(res, result.token, result.expiresAt);
          res.set('Cache-Control', 'no-store');
          res.json(result.response);
        } catch (error) {
          next(error);
        }
      })();
    },
  );

  /**
   * Revokes whatever session the caller presents and clears the cookie. No
   * guard: signing out must work even when the session is already dead, and it
   * can only ever revoke the token in the caller's own cookie.
   */
  router.post('/admin/logout', (req, res, next) => {
    void (async () => {
      try {
        await service.logout(readSessionToken(req));
        clearSessionCookie(res);
        res.status(204).end();
      } catch (error) {
        next(error);
      }
    })();
  });

  return router;
}

/**
 * B4–B6 — the routes behind `requireSignedIn`: a verified identity, with or
 * without a dealership.
 */
export function createSessionAuthRouter(service: AuthService): Router {
  const router = Router();

  router.get('/me', (req, res, next) => {
    void (async () => {
      try {
        res.set('Cache-Control', 'no-store');
        res.json(await service.me(signedInPrincipal(req)));
      } catch (error) {
        next(error);
      }
    })();
  });

  router.post('/onboarding', validate({ body: OnboardingInput }), (req, res, next) => {
    void (async () => {
      try {
        const principal = signedInPrincipal(req);
        if (principal.kind !== 'PENDING') {
          throw new ForbiddenError('This account already manages a dealership.', {
            code: 'DEALER_ALREADY_EXISTS',
          });
        }

        const body = validated<OnboardingInput>(req, 'body');
        res.status(201).json(await service.onboard(principal, body));
      } catch (error) {
        next(error);
      }
    })();
  });

  router.post('/logout', (req, res, next) => {
    void (async () => {
      try {
        await service.logout(readSessionToken(req), signedInPrincipal(req).userId);
        clearSessionCookie(res);
        res.status(204).end();
      } catch (error) {
        next(error);
      }
    })();
  });

  return router;
}
