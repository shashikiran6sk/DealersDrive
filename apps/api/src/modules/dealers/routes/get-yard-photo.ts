import { dealerPrincipal } from '../../../middleware/auth.js';

import { type DealersRoute } from './route.js';

/**
 * The yard photograph — three writes and a read, mounted beside the KYC
 * documents because a dealer meets them on the same onboarding step, and
 * kept separate from them because it is the opposite kind of image: destined
 * for the public portfolio rather than for a moderator's eyes only.
 */
export const getYardPhoto: DealersRoute = (router, service) => {
  router.get('/yard-photo', (req, res, next) => {
    void (async () => {
      try {
        const { dealerId } = dealerPrincipal(req);
        res.json(await service.yardPhoto(dealerId));
      } catch (error) {
        next(error);
      }
    })();
  });
};
