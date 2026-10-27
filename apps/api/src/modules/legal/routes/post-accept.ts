import { LegalAcceptInput } from '@dealers-drive/contracts';
import type { Router } from 'express';

import { env } from '../../../config/env.js';
import { validate, validated } from '../../../middleware/validate.js';
import { ForbiddenError, UnauthorizedError } from '../../../platform/errors.js';
import type { LegalService } from '../legal.service.js';

export function postLegalAccept(router: Router, service: LegalService): void {
  router.post('/accept', validate({ body: LegalAcceptInput }), async (req, res, next) => {
    try {
      const origin = req.get('origin');
      const site = req.get('sec-fetch-site');
      if ((origin && !env.webOrigins.includes(origin)) || site === 'cross-site') {
        throw new ForbiddenError('Use the sign-in form to accept the policies.', {
          code: 'LEGAL_ORIGIN_FORBIDDEN',
        });
      }
      if (!req.is('application/json')) throw new ForbiddenError('Submit acceptance as JSON.');
      const person = req.principal;
      if (!person || person.kind === 'ADMIN') throw new UnauthorizedError();
      res.set('Cache-Control', 'no-store');
      res.json(await service.accept(person, validated<LegalAcceptInput>(req, 'body').scope));
    } catch (error) {
      next(error);
    }
  });
}
