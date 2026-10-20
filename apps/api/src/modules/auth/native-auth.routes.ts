import { Router, type RequestHandler } from 'express';
import { UnauthorizedError } from '../../platform/errors.js';
import { requireLegalOrigin } from '../legal/legal.facade.js';
import { readCustomerBearer } from './native-customer-token.js';
import { getNativeMe } from './routes/native/get-me.js';
import { postNativeLogout } from './routes/native/post-logout.js';
import { postNativeOtp } from './routes/native/post-otp.js';
import { postNativeResend } from './routes/native/post-resend.js';
import { postNativeVerify } from './routes/native/post-verify.js';
import { postNativeSignUp } from './routes/native/post-sign-up.js';
import { postNativeReactivate } from './routes/native/post-reactivate.js';
import type { NativeAuthRouteDeps } from './routes/native/route.js';

export function createNativeAuthRouter(
  deps: NativeAuthRouteDeps,
  requireCustomer: RequestHandler,
): Router {
  const router = Router();
  router.use((req, res, next) => {
    res.set('Cache-Control', 'no-store');
    if (req.method === 'POST') requireLegalOrigin(req, res, next);
    else next();
  });
  router.use((req, _res, next) =>
    req.path === '/logout' && !readCustomerBearer(req) ? next(new UnauthorizedError()) : next(),
  );
  postNativeLogout(router, deps);
  router.use((_req, _res, next) => {
    try {
      deps.service.assertEnabled();
      next();
    } catch (error) {
      next(error);
    }
  });
  for (const register of [
    postNativeOtp,
    postNativeResend,
    postNativeVerify,
    postNativeSignUp,
    postNativeReactivate,
  ])
    register(router, deps);
  router.use((req, _res, next) =>
    readCustomerBearer(req) ? next() : next(new UnauthorizedError()),
  );
  router.use(requireCustomer);
  getNativeMe(router, deps);
  return router;
}
