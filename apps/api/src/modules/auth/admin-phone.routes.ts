import {
  AdminPhoneChallengeInput,
  AdminPhoneVerifyInput,
  AdminPhoneRevokeInput,
} from '@dealers-drive/contracts';
import { Router, type Request, type RequestHandler } from 'express';
import { env } from '../../config/env.js';
import { adminPrincipal } from '../../middleware/auth.js';
import { validate, validated } from '../../middleware/validate.js';
import { ForbiddenError } from '../../platform/errors.js';
import type { AdminPhoneService } from './admin-phone.service.js';
import {
  clearAdminSessionCookie,
  readAdminSessionToken,
  setSessionCookie,
} from './session.cookie.js';

export const adminPhoneOriginGuard: RequestHandler = (req, res, next) => {
  res.set('Cache-Control', 'private, no-store');
  if (
    !env.webOrigins.includes(req.get('origin') ?? '') ||
    req.get('sec-fetch-site') === 'cross-site' ||
    !req.is('application/json')
  ) {
    next(
      new ForbiddenError('Start this action from Dealers-Drive.', {
        code: 'ADMIN_SECURITY_ORIGIN_REQUIRED',
      }),
    );
    return;
  }
  next();
};

export function createAdminPhoneLoginRouter(service: AdminPhoneService) {
  const router = Router();
  router.get('/admin/phone/widget', (_req, res) => {
    res.set('Cache-Control', 'no-store');
    res.json(service.widget());
  });
  router.post(
    '/admin/phone/challenge',
    adminPhoneOriginGuard,
    validate({ body: AdminPhoneChallengeInput }),
    async (req, res) => {
      res.json(
        await service.challenge(
          'LOGIN',
          validated<AdminPhoneChallengeInput>(req, 'body').phone,
          req.ip ?? 'unknown',
        ),
      );
    },
  );
  router.post(
    '/admin/phone/verify',
    adminPhoneOriginGuard,
    validate({ body: AdminPhoneVerifyInput }),
    async (req, res) => {
      const session = await service.verify(
        'LOGIN',
        validated<AdminPhoneVerifyInput>(req, 'body'),
        undefined,
        readAdminSessionToken(req),
      );
      if (!session) throw new Error('Admin login issued no session');
      setSessionCookie(res, session.token, session.expiresAt, true);
      res.json({ returnTo: '/admin' });
    },
  );
  return router;
}
export function createAdminPhoneSecurityRouter(service: AdminPhoneService) {
  const router = Router();
  router.get('/profile/security', async (req, res) => {
    res.set('Cache-Control', 'private, no-store');
    res.json(await service.security(adminPrincipal(req)));
  });
  router.post(
    '/profile/security/phone/challenge',
    adminPhoneOriginGuard,
    validate({ body: AdminPhoneChallengeInput }),
    async (req, res) => {
      res.json(
        await service.challenge(
          'ENROLL',
          validated<AdminPhoneChallengeInput>(req, 'body').phone,
          req.ip ?? 'unknown',
          adminPrincipal(req),
        ),
      );
    },
  );
  router.post(
    '/profile/security/phone/verify',
    adminPhoneOriginGuard,
    validate({ body: AdminPhoneVerifyInput }),
    async (req, res) => {
      await service.verify(
        'ENROLL',
        validated<AdminPhoneVerifyInput>(req, 'body'),
        adminPrincipal(req),
      );
      res.json(await service.security(adminPrincipal(req)));
    },
  );
  router.post(
    '/profile/security/phone/revoke',
    adminPhoneOriginGuard,
    validate({ body: AdminPhoneRevokeInput }),
    async (req: Request, res) => {
      await service.revoke(adminPrincipal(req));
      clearAdminSessionCookie(res);
      res.status(204).end();
    },
  );
  return router;
}
