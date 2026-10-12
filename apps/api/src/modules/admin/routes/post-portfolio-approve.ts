import { IdParam, type IdParam as IdParamType } from '@dealers-drive/contracts';

import { adminPrincipal } from '../../../middleware/auth.js';
import { validate, validated } from '../../../middleware/validate.js';

import { handle, type AdminRoute } from './route.js';

export const postPortfolioApprove: AdminRoute = (router, service) => {
  router.post(
    '/portfolio/:id/approve',
    validate({ params: IdParam }),
    handle((req) =>
      service.portfolio.approve(adminPrincipal(req), validated<IdParamType>(req, 'params').id),
    ),
  );
};
