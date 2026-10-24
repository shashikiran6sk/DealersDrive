import { LegalStatusQuery, type LegalScope } from '@dealers-drive/contracts';
import type { Router } from 'express';

import { validate, validated } from '../../../middleware/validate.js';
import { UnauthorizedError } from '../../../platform/errors.js';
import type { LegalService } from '../legal.service.js';

export function getLegalStatus(router: Router, service: LegalService): void {
  router.get('/status', validate({ query: LegalStatusQuery }), async (req, res, next) => {
    try {
      const person = req.principal;
      if (!person || person.kind === 'ADMIN') throw new UnauthorizedError();
      res.set('Cache-Control', 'no-store');
      res.json(await service.status(person, validated<{ scope: LegalScope }>(req, 'query').scope));
    } catch (error) {
      next(error);
    }
  });
}
