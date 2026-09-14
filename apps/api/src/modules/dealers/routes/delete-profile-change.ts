import { dealerPrincipal, requirePermission } from '../../../middleware/auth.js';

import { type DealersRoute } from './route.js';

/**
 * C2c — the dealer taking their own proposal back (**R34**).
 *
 * `DELETE` on the thing being removed, and no body: there is at most one
 * request waiting per dealership, so naming it in the URL would be asking the
 * client for an id it can only have got from the same response that told it
 * the button should exist.
 *
 * A button rather than an inference. The first shape of this read "the dealer
 * retyped the live value" as a cancellation, which made the way out something
 * to discover rather than press — and was wrong on its own terms besides,
 * since an edit that happens to restore the live text is still an edit.
 *
 * `dealer:update` is the permission, because withdrawing is the other half of
 * submitting. It answers **404** when nothing is waiting: the button only
 * renders when there is one, so reaching here empty-handed is a double-click
 * or a stale page, and both want the screen re-read.
 */
export const deleteProfileChange: DealersRoute = (router, service) => {
  router.delete('/profile-change', requirePermission('dealer:update'), (req, res, next) => {
    void (async () => {
      try {
        const { dealerId, userId } = dealerPrincipal(req);
        res.json(await service.withdrawProfileChange(dealerId, userId));
      } catch (error) {
        next(error);
      }
    })();
  });
};
