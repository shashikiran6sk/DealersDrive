import type { RouteRegistrar } from '../../../http/route.js';
import type { AdminService } from '../admin.service.js';

export type AdminRoute = RouteRegistrar<AdminService>;

export { handle } from './handle.js';
