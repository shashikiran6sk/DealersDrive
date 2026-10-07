import { AdminNotificationsQuery } from '@dealers-drive/contracts';

import { requirePermission } from '../../../middleware/auth.js';
import { validate, validated } from '../../../middleware/validate.js';

import { handle, type AdminNotificationsRoute } from './route.js';

export const getAdminNotifications: AdminNotificationsRoute = (router, service) => {
  router.get(
    '/notifications',
    requirePermission('admin:notifications:read'),
    validate({ query: AdminNotificationsQuery }),
    handle((req) => service.list(validated<AdminNotificationsQuery>(req, 'query'))),
  );
};
