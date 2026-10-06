import { requirePermission } from '../../../middleware/auth.js';

import { handle, type SalesRoute } from './route.js';

export const getPhoneWidget: SalesRoute = (router, { service }) => {
  router.get(
    '/phone/widget',
    requirePermission('sales:dealer:create'),
    handle(() => Promise.resolve(service.widget())),
  );
};
