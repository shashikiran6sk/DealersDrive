import { TermsAcceptanceInput } from '@dealers-drive/contracts';
import { validate, validated } from '../../../middleware/validate.js';
import { UnauthorizedError } from '../../../platform/errors.js';
import type { LegalRoute } from './route.js';
export const postTerms: LegalRoute = (router, service) => {
  router.post('/terms', validate({ body: TermsAcceptanceInput }), (req, res, next) => {
    void (async () => {
      if (!req.principal) throw new UnauthorizedError();
      res
        .set('Cache-Control', 'no-store')
        .json(await service.terms(req.principal, validated<TermsAcceptanceInput>(req, 'body')));
    })().catch(next);
  });
};
