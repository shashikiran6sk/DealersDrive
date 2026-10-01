'use server';

import {
  IdParam,
  SupportMessageInput,
  SupportNoteInput,
  UpdateSupportTicketInput,
  type AdminSupportTicketDetail,
} from '@dealers-drive/contracts';
import { revalidatePath } from 'next/cache';

import { ApiError, apiSend } from '@/lib/api';

import { ADMIN_SUPPORT_ACTION_TEXT } from './support-actions.constants';

export type AdminSupportResult = { ok: true } | { ok: false; message: string };

export interface TicketChanges {
  status?: string;
  priority?: string;
  assignedAdminId?: string | null;
}

async function send(
  ticketId: string,
  method: 'POST' | 'PATCH',
  suffix: string,
  body: unknown,
): Promise<AdminSupportResult> {
  try {
    await apiSend<AdminSupportTicketDetail>(
      method,
      `/v1/admin/support/tickets/${encodeURIComponent(ticketId)}${suffix}`,
      body,
    );
  } catch (error) {
    if (error instanceof ApiError) {
      return { ok: false, message: error.userMessage(ADMIN_SUPPORT_ACTION_TEXT.failed) };
    }
    return { ok: false, message: ADMIN_SUPPORT_ACTION_TEXT.unavailable };
  }
  revalidatePath(ADMIN_SUPPORT_ACTION_TEXT.detailPath(ticketId));
  revalidatePath(ADMIN_SUPPORT_ACTION_TEXT.listPath);
  return { ok: true };
}

function invalid(message: string | undefined): AdminSupportResult {
  return { ok: false, message: message ?? ADMIN_SUPPORT_ACTION_TEXT.invalid };
}

export async function replyToTicketAction(
  ticketId: string,
  message: string,
): Promise<AdminSupportResult> {
  const id = IdParam.safeParse({ id: ticketId });
  const body = SupportMessageInput.safeParse({ message });
  if (!id.success) return invalid(undefined);
  if (!body.success) return invalid(body.error.issues[0]?.message);
  return send(id.data.id, 'POST', '/messages', body.data);
}

export async function addTicketNoteAction(
  ticketId: string,
  note: string,
): Promise<AdminSupportResult> {
  const id = IdParam.safeParse({ id: ticketId });
  const body = SupportNoteInput.safeParse({ note });
  if (!id.success) return invalid(undefined);
  if (!body.success) return invalid(body.error.issues[0]?.message);
  return send(id.data.id, 'POST', '/notes', body.data);
}

export async function updateTicketAction(
  ticketId: string,
  changes: TicketChanges,
): Promise<AdminSupportResult> {
  const id = IdParam.safeParse({ id: ticketId });
  const body = UpdateSupportTicketInput.safeParse(changes);
  if (!id.success) return invalid(undefined);
  if (!body.success) return invalid(body.error.issues[0]?.message);
  return send(id.data.id, 'PATCH', '', body.data);
}
