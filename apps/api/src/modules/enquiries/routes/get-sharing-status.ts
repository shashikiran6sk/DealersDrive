import { SharingStatusQuery } from '@dealers-drive/contracts';
import { customerPrincipal } from '../../../middleware/auth.js';
import { validate, validated } from '../../../middleware/validate.js';
import type { EnquiriesRoute } from './route.js';

export const getSharingStatus: EnquiriesRoute = (router, { service }) => {
  router.get('/sharing-status', validate({ query: SharingStatusQuery }), (req, res, next) => {
    const query = validated<typeof SharingStatusQuery._output>(req, 'query');
    void service
      .sharingStatus(customerPrincipal(req), query.listingSlug)
      .then((result) => res.set('Cache-Control', 'no-store').json(result))
      .catch(next);
  });
};
