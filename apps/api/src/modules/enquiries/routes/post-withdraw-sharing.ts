import { requireLegalOrigin } from '../../legal/legal.facade.js';
import { LegalEnquiryParam } from '@dealers-drive/contracts';
import { customerPrincipal } from '../../../middleware/auth.js';
import { validate, validated } from '../../../middleware/validate.js';
import type { EnquiriesRoute } from './route.js';
export const postWithdrawSharing: EnquiriesRoute = (router, { service }) => {
  router.post(
    '/:id/withdraw-sharing',
    requireLegalOrigin,
    validate({ params: LegalEnquiryParam }),
    (req, res, next) => {
      void (async () => {
        const { id } = validated<typeof LegalEnquiryParam._output>(req, 'params');
        res
          .set('Cache-Control', 'no-store')
          .json(await service.withdrawSharing(customerPrincipal(req), id));
      })().catch(next);
    },
  );
};
