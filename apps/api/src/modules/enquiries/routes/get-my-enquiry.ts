import { LegalEnquiryParam } from '@dealers-drive/contracts';
import { customerPrincipal } from '../../../middleware/auth.js';
import { validate, validated } from '../../../middleware/validate.js';
import type { EnquiriesRoute } from './route.js';
export const getMyEnquiry: EnquiriesRoute = (router, { service }) => {
  router.get('/:id', validate({ params: LegalEnquiryParam }), (req, res, next) => {
    void (async () => {
      const { id } = validated<typeof LegalEnquiryParam._output>(req, 'params');
      res.set('Cache-Control', 'no-store').json(await service.one(customerPrincipal(req), id));
    })().catch(next);
  });
};
