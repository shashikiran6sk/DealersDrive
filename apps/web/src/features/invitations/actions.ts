'use server';

import { AcceptInvitationResponse, IdParam } from '@dealers-drive/contracts';
import { revalidatePath } from 'next/cache';

import { enterWorkspaceAction } from '@/features/auth/customer-account-actions';
import { ApiError, apiSend } from '@/lib/api';

import { INVITATION_PATHS, INVITATIONS_TEXT } from './invitations.constants';

export type InvitationResult = { ok: true } | { ok: false; message: string };

function failure(error: unknown): InvitationResult {
  if (error instanceof ApiError) {
    return { ok: false, message: error.userMessage(INVITATIONS_TEXT.failed) };
  }
  return { ok: false, message: INVITATIONS_TEXT.unavailable };
}

export async function acceptInvitationAction(invitationId: string): Promise<InvitationResult> {
  const id = IdParam.safeParse({ id: invitationId });
  if (!id.success) return { ok: false, message: INVITATIONS_TEXT.failed };

  let membershipId: string;
  try {
    const accepted = AcceptInvitationResponse.parse(
      await apiSend<unknown>('POST', INVITATION_PATHS.accept(id.data.id)),
    );
    membershipId = accepted.membershipId;
  } catch (error) {
    return failure(error);
  }

  await enterWorkspaceAction(membershipId);
  return { ok: true };
}

export async function declineInvitationAction(invitationId: string): Promise<InvitationResult> {
  const id = IdParam.safeParse({ id: invitationId });
  if (!id.success) return { ok: false, message: INVITATIONS_TEXT.failed };
  try {
    await apiSend<void>('POST', INVITATION_PATHS.decline(id.data.id));
  } catch (error) {
    return failure(error);
  }
  revalidatePath(INVITATIONS_TEXT.path);
  return { ok: true };
}
