import { DealerAcceptanceInput } from '@dealers-drive/contracts';
import { dealerPrincipal } from '../../../middleware/auth.js';
import { validate, validated } from '../../../middleware/validate.js';
import type { LegalRoute } from './route.js';
export const postDealerAgreement: LegalRoute = (router, service) => {
  router.post('/dealer-agreement', validate({ body: DealerAcceptanceInput }), (req, res, next) => {
    void (async () => {
      res
        .set('Cache-Control', 'no-store')
        .json(
          await service.dealer(dealerPrincipal(req), validated<DealerAcceptanceInput>(req, 'body')),
        );
    })().catch(next);
  });
};
