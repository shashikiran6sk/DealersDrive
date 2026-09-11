import {
  OnboardingInput,
  PhoneVerificationInput,
  PhoneVerificationStartInput,
} from '@dealers-drive/contracts';
import { Router } from 'express';

import { env } from '../../config/env.js';
import { signedInPrincipal } from '../../middleware/auth.js';
import { validate, validated } from '../../middleware/validate.js';
import { ForbiddenError } from '../../platform/errors.js';
import type { AuthService } from './auth.service.js';
import { openTransaction, type OAuthAudience } from './oauth-transaction.js';
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
export function createPublicAuthRouter(service: AuthService): Router {
  const router = Router();

  /**
   * `/google/start` and `/admin/google/start` are the same handler with one
   * value changed, and that value is the only difference between the two
   * consoles' sign-ins: it is sealed into the transaction cookie and decides
   * the scope of the session the callback issues.
   */
  const start =
    (audience: OAuthAudience) =>
    (
      req: Parameters<Parameters<Router['get']>[1]>[0],
      res: Parameters<Parameters<Router['get']>[1]>[1],
      next: Parameters<Parameters<Router['get']>[1]>[2],
    ): void => {
      try {
        const returnTo = typeof req.query.returnTo === 'string' ? req.query.returnTo : undefined;
        const { authorizationUrl, cookie, maxAgeSeconds } = service.startGoogle(returnTo, audience);

        setOAuthCookie(res, cookie, maxAgeSeconds);
        res.redirect(302, authorizationUrl);
      } catch (error) {
        next(error);
      }
    };

  router.get('/providers', (_req, res) => {
    res.set('Cache-Control', 'no-store');
    res.json(service.providers());
  });

  router.get('/google/start', start('DEALER'));
  router.get('/admin/google/start', start('ADMIN'));

  router.get('/google/callback', (req, res, next) => {
    void (async () => {
      // Resolved before the try, because a failure has to know which sign-in
      // screen to send the browser back to — and the audience is in the cookie,
      // not in anything the callback carries.
      let signInPath = '/dealer/login';
      const back = (code: string) =>
        res.redirect(302, `${env.WEB_BASE_URL}${signInPath}?error=${code}`);

      try {
        const transaction = openTransaction(readOAuthCookie(req));
        if (transaction?.audience === 'ADMIN') signInPath = '/admin/login';
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
        if (code === 'ADMIN_NOT_ALLOWLISTED') {
          back('not_authorised');
          return;
        }
        next(error);
      }
    })();
  });

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

  /**
   * B7 — phone verification (**R39**), two routes and neither of them signs
   * anybody in.
   *
   * They sit behind `requireSignedIn` alongside `/me` and `/onboarding`, which
   * is the whole security posture in one line: the caller is already an
   * authenticated dealer, established by Google, and what happens here is a
   * claim about their handset rather than about who they are.
   */
  router.post('/phone/start', validate({ body: PhoneVerificationStartInput }), (req, res, next) => {
    void (async () => {
      try {
        res.set('Cache-Control', 'no-store');
        res.json(
          await service.startPhoneVerification(
            signedInPrincipal(req),
            validated<PhoneVerificationStartInput>(req, 'body'),
            req.ip ?? 'unknown',
          ),
        );
      } catch (error) {
        next(error);
      }
    })();
  });

  router.post('/phone/verify', validate({ body: PhoneVerificationInput }), (req, res, next) => {
    void (async () => {
      try {
        res.set('Cache-Control', 'no-store');
        res.json(
          await service.verifyPhone(
            signedInPrincipal(req),
            validated<PhoneVerificationInput>(req, 'body'),
          ),
        );
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
