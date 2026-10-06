import { Router } from 'express';

import type { AdminMembersService } from './admin-members.service.js';
import { getMemberHistory } from './routes/get-member-history.js';
import { getMembers } from './routes/get-members.js';
import { patchMember } from './routes/patch-member.js';
import { postMemberActivate } from './routes/post-member-activate.js';
import { postMemberDisable } from './routes/post-member-disable.js';
import { postMember } from './routes/post-member.js';
import type { AdminMembersRoute } from './routes/route.js';

const ROUTES: AdminMembersRoute[] = [
  getMembers,
  postMember,
  getMemberHistory,
  patchMember,
  postMemberDisable,
  postMemberActivate,
];

export function createAdminMembersRouter(service: AdminMembersService): Router {
  const router = Router();
  for (const route of ROUTES) route(router, service);
  return router;
}
