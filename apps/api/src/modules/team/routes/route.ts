import type { RouteRegistrar } from '../../../http/route.js';
import type { InvitationsService } from '../invitations.service.js';
import type { TeamService } from '../team.service.js';

export type TeamRoute = RouteRegistrar<TeamService>;
export type InvitationsRoute = RouteRegistrar<InvitationsService>;
