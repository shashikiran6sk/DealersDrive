import type { RouteRegistrar } from '../../../http/route.js';
import type { AdminMembersService } from '../admin-members.service.js';

export type AdminMembersRoute = RouteRegistrar<AdminMembersService>;

export { handle } from '../../admin/routes/handle.js';
