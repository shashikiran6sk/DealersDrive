'use server';

import {
  IdParam,
  InviteMemberInput,
  UpdateMemberInput,
  type TeamInvitation,
  type TeamMember,
} from '@dealers-drive/contracts';
import { revalidatePath } from 'next/cache';

import { ApiError, apiSend } from '@/lib/api';

import { TEAM_ACTION_TEXT, TEAM_PATHS } from './team-actions.constants';

export type TeamActionResult = { ok: true } | { ok: false; message: string };

async function attempt(work: () => Promise<unknown>): Promise<TeamActionResult> {
  try {
    await work();
  } catch (error) {
    if (error instanceof ApiError) {
      return { ok: false, message: error.userMessage(TEAM_ACTION_TEXT.failed) };
    }
    return { ok: false, message: TEAM_ACTION_TEXT.unavailable };
  }
  revalidatePath(TEAM_ACTION_TEXT.teamPath);
  return { ok: true };
}

export async function inviteMemberAction(phone: string, role: string): Promise<TeamActionResult> {
  const body = InviteMemberInput.safeParse({ phone, role });
  if (!body.success) return { ok: false, message: TEAM_ACTION_TEXT.invalid };
  return attempt(() => apiSend<TeamInvitation>('POST', TEAM_PATHS.invitations, body.data));
}

export async function revokeInvitationAction(invitationId: string): Promise<TeamActionResult> {
  const id = IdParam.safeParse({ id: invitationId });
  if (!id.success) return { ok: false, message: TEAM_ACTION_TEXT.invalid };
  return attempt(() => apiSend<void>('DELETE', TEAM_PATHS.invitation(id.data.id)));
}

export async function changeMemberRoleAction(
  memberId: string,
  role: string,
): Promise<TeamActionResult> {
  const id = IdParam.safeParse({ id: memberId });
  const body = UpdateMemberInput.safeParse({ role });
  if (!id.success || !body.success) return { ok: false, message: TEAM_ACTION_TEXT.invalid };
  return attempt(() => apiSend<TeamMember>('PATCH', TEAM_PATHS.member(id.data.id), body.data));
}

export async function removeMemberAction(memberId: string): Promise<TeamActionResult> {
  const id = IdParam.safeParse({ id: memberId });
  if (!id.success) return { ok: false, message: TEAM_ACTION_TEXT.invalid };
  return attempt(() => apiSend<void>('DELETE', TEAM_PATHS.member(id.data.id)));
}
