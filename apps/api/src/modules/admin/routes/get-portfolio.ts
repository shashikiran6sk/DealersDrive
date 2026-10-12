import {
  PortfolioModerationQuery,
  type PortfolioModerationQuery as PortfolioModerationQueryType,
} from '@dealers-drive/contracts';

import { adminPrincipal } from '../../../middleware/auth.js';
import { validate, validated } from '../../../middleware/validate.js';

import { handle, type AdminRoute } from './route.js';

export const getPortfolio: AdminRoute = (router, service) => {
  router.get(
    '/portfolio',
    validate({ query: PortfolioModerationQuery }),
    handle((req) =>
      service.portfolio.queue(
        adminPrincipal(req),
        validated<PortfolioModerationQueryType>(req, 'query'),
      ),
    ),
  );
};
