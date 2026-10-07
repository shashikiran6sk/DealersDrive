import type { RouteRegistrar } from '../../../http/route.js';
import type { AdminNotificationsService } from '../notifications.admin.service.js';

export type AdminNotificationsRoute = RouteRegistrar<AdminNotificationsService>;

export { handle } from '../../admin/routes/handle.js';
