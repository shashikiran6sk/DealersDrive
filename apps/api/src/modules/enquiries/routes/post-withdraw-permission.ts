import { SharingGrantParam } from '@dealers-drive/contracts';
import { customerPrincipal } from '../../../middleware/auth.js';
import { validate, validated } from '../../../middleware/validate.js';
import { requireLegalOrigin, requireLegalRelease } from '../../legal/legal.facade.js';
import type { EnquiriesRoute } from './route.js';

export const postWithdrawPermission: EnquiriesRoute = (router, { service }) => {
  router.post(
    '/sharing-permissions/:id/withdraw',
    requireLegalRelease,
    requireLegalOrigin,
    validate({ params: SharingGrantParam }),
    (req, res, next) => {
      const { id } = validated<typeof SharingGrantParam._output>(req, 'params');
      void service
        .withdrawPermission(customerPrincipal(req), id)
        .then((result) => res.set('Cache-Control', 'no-store').json(result))
        .catch(next);
    },
  );
};
