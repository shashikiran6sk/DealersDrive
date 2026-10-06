'use server';

import {
  DisableAdminMemberInput,
  InviteAdminMemberInput,
  UpdateAdminMemberInput,
  type AdminMemberDto,
} from '@dealers-drive/contracts';
import { revalidatePath } from 'next/cache';

import { ApiError, apiSend } from '@/lib/api';

import { MEMBER_ACTION_TEXT } from './member-actions.constants';

export interface MemberActionResult {
  ok: boolean;
  message?: string;
  member?: AdminMemberDto;
}

const MEMBERS_PATH = '/admin/members';

export async function inviteMemberAction(input: {
  email: string;
  name: string;
  role: string;
}): Promise<MemberActionResult> {
  const parsed = InviteAdminMemberInput.safeParse({
    email: input.email,
    role: input.role,
    ...(input.name.trim() ? { name: input.name } : {}),
  });
  if (!parsed.success) {
    const field = parsed.error.issues[0]?.path[0];
    return {
      ok: false,
      message: field === 'email' ? MEMBER_ACTION_TEXT.badEmail : MEMBER_ACTION_TEXT.badRole,
    };
  }
  return send(
    () => apiSend<AdminMemberDto>('POST', '/v1/admin/members', parsed.data),
    MEMBER_ACTION_TEXT.inviteFailed,
  );
}

export async function changeMemberRoleAction(
  id: string,
  role: string,
): Promise<MemberActionResult> {
  const parsed = UpdateAdminMemberInput.safeParse({ role });
  if (!parsed.success) return { ok: false, message: MEMBER_ACTION_TEXT.badRole };
  return send(
    () =>
      apiSend<AdminMemberDto>('PATCH', `/v1/admin/members/${encodeURIComponent(id)}`, parsed.data),
    MEMBER_ACTION_TEXT.roleFailed,
  );
}

export async function disableMemberAction(id: string, reason: string): Promise<MemberActionResult> {
  const parsed = DisableAdminMemberInput.safeParse({ reason });
  if (!parsed.success) return { ok: false, message: MEMBER_ACTION_TEXT.needReason };
  return send(
    () =>
      apiSend<AdminMemberDto>(
        'POST',
        `/v1/admin/members/${encodeURIComponent(id)}/disable`,
        parsed.data,
      ),
    MEMBER_ACTION_TEXT.disableFailed,
  );
}

export async function activateMemberAction(id: string): Promise<MemberActionResult> {
  return send(
    () => apiSend<AdminMemberDto>('POST', `/v1/admin/members/${encodeURIComponent(id)}/activate`),
    MEMBER_ACTION_TEXT.activateFailed,
  );
}

async function send(
  work: () => Promise<AdminMemberDto>,
  fallback: string,
): Promise<MemberActionResult> {
  try {
    const member = await work();
    revalidatePath(MEMBERS_PATH);
    return { ok: true, member };
  } catch (error) {
    if (error instanceof ApiError) return { ok: false, message: error.userMessage(fallback) };
    return { ok: false, message: fallback };
  }
}
