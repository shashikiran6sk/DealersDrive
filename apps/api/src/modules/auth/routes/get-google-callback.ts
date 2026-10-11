import {
  clearOAuthCookie,
  readOAuthCookie,
  readAdminOAuthCookie,
  readSessionToken,
  setSessionCookie,
} from '../session.cookie.js';
import { env } from '../../../config/env.js';
import { errorCode } from '../../../platform/errors.js';
import { openTransaction, type OAuthAudience } from '../oauth-transaction.js';
import { recordOAuthAttempt, type OAuthReason } from '../../../platform/telemetry/metrics.js';

import type { PublicAuthRoute } from './route.js';

export const getGoogleCallback: PublicAuthRoute = (router, { service }) => {
  router.get('/google/callback', (req, res, next) => {
    void (async () => {
      let signInPath = '/dealer/login';
      let audience: OAuthAudience = 'DEALER';
      const back = (code: OAuthReason) => {
        recordOAuthAttempt(audience, 'failure', code);
        res.redirect(302, `${env.WEB_BASE_URL}${signInPath}?error=${code}`);
      };

      try {
        const stateQuery = typeof req.query.state === 'string' ? req.query.state : '';
        const personTransaction = openTransaction(readOAuthCookie(req));
        const adminTransaction = openTransaction(readAdminOAuthCookie(req));
        const transaction =
          adminTransaction?.state === stateQuery
            ? adminTransaction
            : personTransaction?.state === stateQuery
              ? personTransaction
              : null;
        audience = transaction?.audience ?? 'DEALER';
        if (audience === 'ADMIN') signInPath = '/admin/login';
        if (audience === 'LINK') signInPath = '/dealer/onboarding';
        if (transaction) clearOAuthCookie(res, audience === 'ADMIN');

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
          sessionToken: readSessionToken(req),
          ip: req.ip,
          userAgent: req.get('user-agent'),
        });

        if (result.token && result.expiresAt) {
          setSessionCookie(res, result.token, result.expiresAt, result.audience === 'ADMIN');
        }
        recordOAuthAttempt(result.audience, 'success', 'completed');
        res.redirect(302, `${env.WEB_BASE_URL}${result.returnTo}`);
      } catch (error) {
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
        if (code === 'IDENTITY_ALREADY_LINKED' || code === 'DEALER_EMAIL_TAKEN') {
          back('identity_already_linked');
          return;
        }
        if (code === 'LINK_SESSION_MISMATCH') {
          back('link_session_mismatch');
          return;
        }
        if (code === 'ACCOUNT_SUSPENDED') {
          back('account_suspended');
          return;
        }
        if (code === 'APPLICATION_CLOSED') {
          back('application_closed');
          return;
        }
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
