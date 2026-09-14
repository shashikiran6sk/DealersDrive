'use server';

import {
  ApproveDealerInput,
  NoteInput,
  ReasonInput,
  UpdateDealerInput,
  type DealerModerationResponse,
  type DealerProfile,
  type DealerPurgeResponse,
  type ProfileChangeDecisionResponse,
  type VerifyDocumentResponse,
} from '@dealers-drive/contracts';
import { revalidatePath } from 'next/cache';

import { ApiError, apiSend } from '@/lib/api';
import { revalidatePublicDealer } from '@/lib/cache-tags';

export interface AdminResult<T = undefined> {
  ok: boolean;
  message?: string;
  data?: T;
}

function fail(error: unknown, fallback: string): AdminResult<never> {
  if (error instanceof ApiError) {
    return { ok: false, message: error.userMessage(error.problem.title) };
  }
  return { ok: false, message: fallback };
}

function refreshAdmin(slug?: string): void {
  revalidatePath('/admin', 'layout');
  revalidatePublicDealer(slug);
}

export async function approveDealerAction(
  dealerId: string,
  input: unknown,
  slug?: string,
): Promise<AdminResult<DealerModerationResponse>> {
  const parsed = ApproveDealerInput.safeParse(input ?? {});
  if (!parsed.success) return { ok: false, message: 'That approval is not valid.' };

  try {
    const data = await apiSend<DealerModerationResponse>(
      'POST',
      `/v1/admin/dealers/${dealerId}/approve`,
      parsed.data,
    );
    refreshAdmin(slug);
    return { ok: true, data };
  } catch (error) {
    return fail(error, 'We could not approve that dealer.');
  }
}

export async function reinstateDealerAction(
  dealerId: string,
  input: unknown,
  slug?: string,
): Promise<AdminResult<DealerModerationResponse>> {
  const parsed = NoteInput.safeParse(input ?? {});
  if (!parsed.success) return { ok: false, message: 'That note is not valid.' };

  try {
    const data = await apiSend<DealerModerationResponse>(
      'POST',
      `/v1/admin/dealers/${dealerId}/reinstate`,
      parsed.data,
    );
    refreshAdmin(slug);
    return { ok: true, data };
  } catch (error) {
    return fail(error, 'We could not reinstate that dealer.');
  }
}

export async function verifyDocumentAction(
  documentId: string,
  slug?: string,
): Promise<AdminResult<VerifyDocumentResponse>> {
  try {
    const data = await apiSend<VerifyDocumentResponse>(
      'POST',
      `/v1/admin/documents/${documentId}/verify`,
    );
    refreshAdmin(slug);
    return { ok: true, data };
  } catch (error) {
    return fail(error, 'We could not verify that document.');
  }
}

export async function rejectDocumentAction(
  documentId: string,
  input: unknown,
  slug?: string,
): Promise<AdminResult<VerifyDocumentResponse>> {
  const parsed = ReasonInput.safeParse(input);
  if (!parsed.success) return { ok: false, message: 'A rejection needs a reason.' };

  try {
    const data = await apiSend<VerifyDocumentResponse>(
      'POST',
      `/v1/admin/documents/${documentId}/reject`,
      parsed.data,
    );
    refreshAdmin(slug);
    return { ok: true, data };
  } catch (error) {
    return fail(error, 'We could not reject that document.');
  }
}

export async function rejectDealerAction(
  dealerId: string,
  input: unknown,
  slug?: string,
): Promise<AdminResult<DealerPurgeResponse>> {
  const parsed = ReasonInput.safeParse(input);
  if (!parsed.success) return { ok: false, message: 'A rejection needs a reason.' };

  try {
    const data = await apiSend<DealerPurgeResponse>(
      'POST',
      `/v1/admin/dealers/${dealerId}/reject`,
      parsed.data,
    );
    refreshAdmin(slug);
    return { ok: true, data };
  } catch (error) {
    return fail(error, 'We could not reject that dealer.');
  }
}

export async function requestDealerChangesAction(
  dealerId: string,
  input: unknown,
  slug?: string,
): Promise<AdminResult<DealerModerationResponse>> {
  const parsed = ReasonInput.safeParse(input);
  if (!parsed.success) return { ok: false, message: 'Say what the dealer needs to change.' };

  try {
    const data = await apiSend<DealerModerationResponse>(
      'POST',
      `/v1/admin/dealers/${dealerId}/request-changes`,
      parsed.data,
    );
    refreshAdmin(slug);
    return { ok: true, data };
  } catch (error) {
    return fail(error, 'We could not send that back to the dealer.');
  }
}

export async function updateDealerAction(
  dealerId: string,
  input: unknown,
): Promise<AdminResult<DealerProfile> & { errors?: Record<string, string> }> {
  const parsed = UpdateDealerInput.safeParse(input);
  if (!parsed.success) {
    const errors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const field = issue.path.map(String).join('.');
      errors[field] ??= issue.message;
    }
    return { ok: false, message: 'Some of those details are not valid.', errors };
  }

  try {
    const data = await apiSend<DealerProfile>(
      'PATCH',
      `/v1/admin/dealers/${dealerId}`,
      parsed.data,
    );
    refreshAdmin(data.slug);
    return { ok: true, data };
  } catch (error) {
    const result = fail(error, 'We could not save those changes.');
    return error instanceof ApiError ? { ...result, errors: error.fieldErrors() } : result;
  }
}

export async function suspendDealerAction(
  dealerId: string,
  input: unknown,
  slug?: string,
): Promise<AdminResult<DealerModerationResponse>> {
  const parsed = ReasonInput.safeParse(input);
  if (!parsed.success) return { ok: false, message: 'A suspension needs a reason.' };

  try {
    const data = await apiSend<DealerModerationResponse>(
      'POST',
      `/v1/admin/dealers/${dealerId}/suspend`,
      parsed.data,
    );
    refreshAdmin(slug);
    return { ok: true, data };
  } catch (error) {
    return fail(error, 'We could not suspend that dealer.');
  }
}

export async function approveProfileChangeAction(
  changeId: string,
): Promise<AdminResult<ProfileChangeDecisionResponse>> {
  try {
    const data = await apiSend<ProfileChangeDecisionResponse>(
      'POST',
      `/v1/admin/profile-changes/${changeId}/approve`,
      {},
    );
    refreshAdmin(data.dealerSlug);
    return { ok: true, data };
  } catch (error) {
    return fail(error, 'We could not publish that change.');
  }
}

export async function rejectProfileChangeAction(
  changeId: string,
  input: unknown,
): Promise<AdminResult<ProfileChangeDecisionResponse>> {
  const parsed = ReasonInput.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: 'Tell the dealer what was wrong with it — a sentence is enough.' };
  }

  try {
    const data = await apiSend<ProfileChangeDecisionResponse>(
      'POST',
      `/v1/admin/profile-changes/${changeId}/reject`,
      parsed.data,
    );
    refreshAdmin(data.dealerSlug);
    return { ok: true, data };
  } catch (error) {
    return fail(error, 'We could not refuse that change.');
  }
}
