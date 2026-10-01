import { Router } from 'express';

import { deleteTeamInvitation } from './routes/delete-team-invitation.js';
import { deleteTeamMember } from './routes/delete-team-member.js';
import { getTeam } from './routes/get-team.js';
import { patchTeamMember } from './routes/patch-team-member.js';
import { postTeamInvitation } from './routes/post-team-invitation.js';
import type { TeamRoute } from './routes/route.js';
import type { TeamService } from './team.service.js';

const ROUTES: TeamRoute[] = [
  getTeam,
  postTeamInvitation,
  deleteTeamInvitation,
  patchTeamMember,
  deleteTeamMember,
];

export function createTeamRouter(service: TeamService): Router {
  const router = Router();
  for (const route of ROUTES) route(router, service);
  return router;
}
