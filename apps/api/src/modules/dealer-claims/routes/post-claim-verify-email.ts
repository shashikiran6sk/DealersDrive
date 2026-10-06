import { ClaimTokenParam } from '@dealers-drive/contracts';

import { validate, validated } from '../../../middleware/validate.js';

import { byIp, claimLimit } from './claim-limit.js';
import { handle, type DealerClaimsRoute } from './route.js';

export const postClaimVerifyEmail: DealerClaimsRoute = (router, { service, rateLimit }) => {
  router.post(
    '/:token/verify-email',
    rateLimit('dealer-claims.verify-email.ip', claimLimit(20, 600, byIp)),
    validate({ params: ClaimTokenParam }),
    handle((req) => service.verifyEmail(validated<ClaimTokenParam>(req, 'params').token)),
  );
};
