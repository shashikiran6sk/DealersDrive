import {
  ClaimDealerInput,
  ClaimTokenParam,
  type ClaimDealerResponse,
} from '@dealers-drive/contracts';

import { validate, validated } from '../../../middleware/validate.js';
import { setSessionCookie } from '../../auth/session.cookie.js';

import { byClaimedPhone, byIp, claimLimit } from './claim-limit.js';
import type { DealerClaimsRoute } from './route.js';

export const postClaim: DealerClaimsRoute = (router, { service, rateLimit }) => {
  router.post(
    '/:token/claim',
    rateLimit('dealer-claims.claim.ip', claimLimit(10, 600, byIp)),
    rateLimit('dealer-claims.claim.number', claimLimit(10, 600, byClaimedPhone)),
    validate({ params: ClaimTokenParam, body: ClaimDealerInput }),
    (req, res, next) => {
      void (async () => {
        try {
          const result = await service.claim(
            validated<ClaimTokenParam>(req, 'params').token,
            validated<ClaimDealerInput>(req, 'body'),
            { ip: req.ip, userAgent: req.get('user-agent') },
          );
          setSessionCookie(res, result.token, result.expiresAt);
          res.set('Cache-Control', 'no-store');
          const response: ClaimDealerResponse = {
            dealerId: result.dealerId,
            returnTo: result.returnTo,
          };
          res.json(response);
        } catch (error) {
          next(error);
        }
      })();
    },
  );
};
