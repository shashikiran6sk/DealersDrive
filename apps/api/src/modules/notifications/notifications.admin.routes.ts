import { Router } from 'express';

import type { AdminNotificationsService } from './notifications.admin.service.js';
import { getAdminNotifications } from './routes/get-admin-notifications.js';
import type { AdminNotificationsRoute } from './routes/route.js';

const ROUTES: AdminNotificationsRoute[] = [getAdminNotifications];

export function createAdminNotificationsRouter(service: AdminNotificationsService): Router {
  const router = Router();
  for (const route of ROUTES) route(router, service);
  return router;
}
