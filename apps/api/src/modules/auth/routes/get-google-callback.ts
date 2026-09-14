import { clearOAuthCookie, readOAuthCookie, setSessionCookie } from '../session.cookie.js';
import { env } from '../../../config/env.js';
import { openTransaction, type OAuthAudience } from '../oauth-transaction.js';
import { recordOAuthAttempt, type OAuthReason } from '../../../platform/telemetry/metrics.js';

import type { PublicAuthRoute } from './route.js';

export const getGoogleCallback: PublicAuthRoute = (router, { service }) => {
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
};
