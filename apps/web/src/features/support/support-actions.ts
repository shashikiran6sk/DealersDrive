'use server';

import {
  CreateSupportTicketInput,
  IdParam,
  SupportMessageInput,
  type CustomerSupportTicket,
} from '@dealers-drive/contracts';
import { revalidatePath } from 'next/cache';

import { ApiError, apiSend } from '@/lib/api';

import { SUPPORT_ACTION_TEXT } from './support-actions.constants';

export interface SupportRequestDraft {
  category: string;
  subject: string;
  description: string;
  enquiryId?: string;
}

export type CreateSupportRequestResult =
  | { status: 'created'; id: string }
  | { status: 'invalid'; message: string; fieldErrors: Record<string, string> }
  | { status: 'refused'; message: string }
  | { status: 'signed-out' };

export type ReplySupportRequestResult =
  | { status: 'sent'; ticket?: CustomerSupportTicket }
  | { status: 'invalid'; message: string }
  | { status: 'refused'; code: string; message: string }
  | { status: 'signed-out' };

function fieldErrorsOf(issues: { path: PropertyKey[]; message: string }[]): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const issue of issues) {
    const field = String(issue.path[0] ?? '');
    errors[field] ??= issue.message;
  }
  return errors;
}

export async function createSupportRequestAction(
  draft: SupportRequestDraft,
): Promise<CreateSupportRequestResult> {
  const parsed = CreateSupportTicketInput.safeParse({
    category: draft.category,
    subject: draft.subject,
    description: draft.description,
    ...(draft.enquiryId ? { enquiryId: draft.enquiryId } : {}),
  });
  if (!parsed.success) {
    return {
      status: 'invalid',
      message: SUPPORT_ACTION_TEXT.invalid,
      fieldErrors: fieldErrorsOf(parsed.error.issues),
    };
  }

  try {
    const ticket = await apiSend<CustomerSupportTicket>('POST', '/v1/support/tickets', parsed.data);
    revalidatePath(SUPPORT_ACTION_TEXT.listPath);
    return { status: 'created', id: ticket.id };
  } catch (error) {
    if (error instanceof ApiError) {
      if (error.status === 401) return { status: 'signed-out' };
      if (error.status === 400) {
        return {
          status: 'invalid',
          message: SUPPORT_ACTION_TEXT.invalid,
          fieldErrors: error.fieldErrors(),
        };
      }
      return { status: 'refused', message: error.userMessage(SUPPORT_ACTION_TEXT.failed) };
    }
    return { status: 'refused', message: SUPPORT_ACTION_TEXT.unavailable };
  }
}

export async function replySupportRequestAction(
  ticketId: string,
  message: string,
  clientMessageId?: string,
): Promise<ReplySupportRequestResult> {
  const id = IdParam.safeParse({ id: ticketId });
  const body = SupportMessageInput.safeParse({
    message,
    ...(clientMessageId ? { clientMessageId } : {}),
  });
  if (!id.success) return { status: 'invalid', message: SUPPORT_ACTION_TEXT.failed };
  if (!body.success) {
    return {
      status: 'invalid',
      message: body.error.issues[0]?.message ?? SUPPORT_ACTION_TEXT.invalid,
    };
  }

  let ticket: CustomerSupportTicket;
  try {
    ticket = await apiSend<CustomerSupportTicket>(
      'POST',
      `/v1/support/tickets/${encodeURIComponent(id.data.id)}/messages`,
      body.data,
    );
  } catch (error) {
    if (error instanceof ApiError) {
      if (error.status === 401) return { status: 'signed-out' };
      return {
        status: 'refused',
        code: error.code,
        message: error.userMessage(SUPPORT_ACTION_TEXT.failed),
      };
    }
    return { status: 'refused', code: 'UNAVAILABLE', message: SUPPORT_ACTION_TEXT.unavailable };
  }

  revalidatePath(SUPPORT_ACTION_TEXT.detailPath(id.data.id));
  revalidatePath(SUPPORT_ACTION_TEXT.listPath);
  return { status: 'sent', ticket };
}
