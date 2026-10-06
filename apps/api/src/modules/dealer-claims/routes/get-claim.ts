import { ClaimTokenParam } from '@dealers-drive/contracts';

import { validate, validated } from '../../../middleware/validate.js';

import { byIp, claimLimit } from './claim-limit.js';
import { handle, type DealerClaimsRoute } from './route.js';

export const getClaim: DealerClaimsRoute = (router, { service, rateLimit }) => {
  router.get(
    '/:token',
    rateLimit('dealer-claims.read.ip', claimLimit(60, 600, byIp)),
    validate({ params: ClaimTokenParam }),
    handle((req) => service.preview(validated<ClaimTokenParam>(req, 'params').token)),
  );
};
