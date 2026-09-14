import {
  OnboardingInput,
  PhoneAvailabilityInput,
  VerifyPhoneInput,
} from '@dealers-drive/contracts';
import { Router, type Request } from 'express';

import { env } from '../../config/env.js';
import { signedInPrincipal } from '../../middleware/auth.js';
import type { RateLimiter } from '../../middleware/rate-limit.js';
import { validate, validated } from '../../middleware/validate.js';
import { errorCode, ForbiddenError } from '../../platform/errors.js';
import { recordOAuthAttempt, type OAuthReason } from '../../platform/telemetry/metrics.js';
import type { AuthService } from './auth.service.js';
import type { PhoneService } from './phone.service.js';
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
      let audience: OAuthAudience = 'DEALER';
      const back = (code: OAuthReason) => {
        recordOAuthAttempt(audience, 'failure', code);
        res.redirect(302, `${env.WEB_BASE_URL}${signInPath}?error=${code}`);
      };

      try {
        const transaction = openTransaction(readOAuthCookie(req));
        audience = transaction?.audience ?? 'DEALER';
        if (audience === 'ADMIN') signInPath = '/admin/login';
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
        recordOAuthAttempt(result.audience, 'success', 'completed');
        res.redirect(302, `${env.WEB_BASE_URL}${result.returnTo}`);
      } catch (error) {
        // A failed sign-in is a screen, not a JSON body — but a bug is still a
        // bug, so anything unexpected goes to the error handler.
        const code = errorCode(error);
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
        // Both refusals of an operations seat land on the same screen: one is
        // "you were never on the list", the other "your seat was closed"
        // (**R41**), and neither is worth telling an unauthenticated caller
        // apart from the other.
        if (code === 'ADMIN_NOT_ALLOWLISTED' || code === 'ADMIN_ACCESS_REVOKED') {
          back('not_authorised');
          return;
        }
        recordOAuthAttempt(audience, 'error', 'internal');
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
export function createSessionAuthRouter(
  service: AuthService,
  phone: PhoneService,
  rateLimit: RateLimiter,
): Router {
  const router = Router();

  /** Counted per person, not per address: a dealership is often one office NAT. */
  const byUser = (req: Request): string => signedInPrincipal(req).userId;

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
   * B8a — the widget configuration.
   *
   * Rate-limited even though it is a read. Each call is a licence to send SMS
   * from a browser, so the limit is on *starting* verifications rather than on
   * reading a config: thirty an hour is far more than a person signing up
   * needs and far less than a script would want.
   */
  router.get(
    '/phone/widget',
    rateLimit('auth.phone.widget', {
      limit: 30,
      windowSeconds: 3600,
      keyBy: byUser,
      code: 'PHONE_OTP_RATE_LIMITED',
      message: 'Too many verification attempts. Try again in a little while.',
    }),
    (_req, res) => {
      res.set('Cache-Control', 'no-store');
      res.json(phone.widget());
    },
  );

  /**
   * B8b — may this account claim this number?
   *
   * The first of the two calls step 1 makes, and the cheap one. It is asked
   * before the browser sends anything, because the send is the browser's and
   * the API cannot refuse one that is already on its way — so a number
   * somebody else holds has to be caught here or not at all, and "not at all"
   * means paying for a message to tell a dealer they cannot have their own
   * number.
   *
   * **Rate-limited because it is a lookup about other people's numbers.** A
   * yes/no about whether the platform knows a number is a yes/no somebody
   * could walk a list through, so it is behind the session like everything
   * else here and capped at the same order as the widget itself. It never says
   * who holds one.
   */
  router.post(
    '/phone/availability',
    rateLimit('auth.phone.availability', {
      limit: 30,
      windowSeconds: 3600,
      keyBy: byUser,
      code: 'PHONE_OTP_RATE_LIMITED',
      message: 'Too many verification attempts. Try again in a little while.',
    }),
    validate({ body: PhoneAvailabilityInput }),
    (req, res, next) => {
      void (async () => {
        try {
          const principal = signedInPrincipal(req);
          const body = validated<PhoneAvailabilityInput>(req, 'body');
          await phone.assertAvailable(principal.userId, body);
          res.set('Cache-Control', 'no-store');
          res.status(204).end();
        } catch (error) {
          next(error);
        }
      })();
    },
  );

  /**
   * B8c — the widget's access token, checked with MSG91 and recorded.
   *
   * The tighter of the two limits, because this is the one that writes. Ten
   * presentations in ten minutes covers a dealer who mistypes a code twice and
   * asks for a fresh one; it does not cover walking a stolen token through a
   * list of numbers.
   */
  router.post(
    '/phone/verify',
    rateLimit('auth.phone.verify', {
      limit: 10,
      windowSeconds: 600,
      keyBy: byUser,
      code: 'PHONE_OTP_RATE_LIMITED',
      message: 'Too many verification attempts. Try again in a little while.',
    }),
    validate({ body: VerifyPhoneInput }),
    (req, res, next) => {
      void (async () => {
        try {
          const principal = signedInPrincipal(req);
          const body = validated<VerifyPhoneInput>(req, 'body');
          res.set('Cache-Control', 'no-store');
          res.json(await phone.verify(principal.userId, body, { ip: req.ip }));
        } catch (error) {
          next(error);
        }
      })();
    },
  );

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
