import type { RequestHandler } from 'express';
import { env } from '../../config/env.js';
import { ForbiddenError } from '../../platform/errors.js';
export const requireLegalOrigin: RequestHandler = (req, _res, next) => {
  const origin = req.get('Origin');
  if (origin && !env.webOrigins.includes(origin) && origin !== new URL(env.API_BASE_URL).origin) {
    next(
      new ForbiddenError('This legal choice must be sent from an authorized application.', {
        code: 'LEGAL_ORIGIN_FORBIDDEN',
      }),
    );
    return;
  }
  next();
};
