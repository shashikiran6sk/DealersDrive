'use server';

import {
  ApproveDealerInput,
  GrantCreditsInput,
  ReasonInput,
  RequestChangesInput,
  TakedownInput,
  type ApproveListingResponse,
  type DealerModerationResponse,
  type GrantCreditsResponse,
  type RejectListingResponse,
  type RequestChangesResponse,
  type TakedownResponse,
} from '@dealers-drive/contracts';
import { revalidatePath } from 'next/cache';

import { ApiError, apiSend } from '@/lib/api';

/**
 * Admin moderation (D4, D6, D9–D12).
 *
 * These are the actions that move credits and change what the public can see,
 * and every one of them is an *event* — the listing state machine decides what
 * it means, and the credit movement rides in the same transaction (Rules 4, 5).
 *
 * The distinction worth keeping straight: **reject** returns the held credit,
 * **request changes** keeps it held, and **approve** consumes it with a
 * zero-delta ledger row so the history stays complete (§9.2).
 */
export interface AdminResult<T = undefined> {
  ok: boolean;
  message?: string;
  data?: T;
}

function fail(error: unknown, fallback: string): AdminResult<never> {
  if (error instanceof ApiError) {
    return { ok: false, message: error.problem.detail ?? error.problem.title };
  }
  return { ok: false, message: fallback };
}

function refreshAdmin(): void {
  revalidatePath('/admin', 'layout');
}

export async function approveListingAction(
  listingId: string,
): Promise<AdminResult<ApproveListingResponse>> {
  try {
    const data = await apiSend<ApproveListingResponse>(
      'POST',
      `/v1/admin/listings/${listingId}/approve`,
    );
    refreshAdmin();
    return { ok: true, data };
  } catch (error) {
    return fail(error, 'We could not approve that listing.');
  }
}

export async function rejectListingAction(
  listingId: string,
  input: unknown,
): Promise<AdminResult<RejectListingResponse>> {
  const parsed = ReasonInput.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: 'A rejection needs a reason the dealer can act on.' };
  }

  try {
    const data = await apiSend<RejectListingResponse>(
      'POST',
      `/v1/admin/listings/${listingId}/reject`,
      parsed.data,
    );
    refreshAdmin();
    return { ok: true, data };
  } catch (error) {
    return fail(error, 'We could not reject that listing.');
  }
}

export async function requestChangesAction(
  listingId: string,
  input: unknown,
): Promise<AdminResult<RequestChangesResponse>> {
  const parsed = RequestChangesInput.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: 'Give a note of at least 6 characters.' };
  }

  try {
    const data = await apiSend<RequestChangesResponse>(
      'POST',
      `/v1/admin/listings/${listingId}/request-changes`,
      parsed.data,
    );
    refreshAdmin();
    return { ok: true, data };
  } catch (error) {
    return fail(error, 'We could not send that request.');
  }
}

export async function takedownListingAction(
  listingId: string,
  input: unknown,
): Promise<AdminResult<TakedownResponse>> {
  const parsed = TakedownInput.safeParse(input);
  if (!parsed.success) return { ok: false, message: 'A takedown needs a reason.' };

  try {
    const data = await apiSend<TakedownResponse>(
      'POST',
      `/v1/admin/listings/${listingId}/takedown`,
      parsed.data,
    );
    refreshAdmin();
    return { ok: true, data };
  } catch (error) {
    return fail(error, 'We could not take that listing down.');
  }
}

export async function approveDealerAction(
  dealerId: string,
  input: unknown,
): Promise<AdminResult<DealerModerationResponse>> {
  const parsed = ApproveDealerInput.safeParse(input ?? {});
  if (!parsed.success) return { ok: false, message: 'That approval is not valid.' };

  try {
    const data = await apiSend<DealerModerationResponse>(
      'POST',
      `/v1/admin/dealers/${dealerId}/approve`,
      parsed.data,
    );
    refreshAdmin();
    return { ok: true, data };
  } catch (error) {
    return fail(error, 'We could not approve that dealer.');
  }
}

export async function suspendDealerAction(
  dealerId: string,
  input: unknown,
): Promise<AdminResult<DealerModerationResponse>> {
  const parsed = ReasonInput.safeParse(input);
  if (!parsed.success) return { ok: false, message: 'A suspension needs a reason.' };

  try {
    // Suspending hides every one of this dealer's listings at once: public
    // visibility requires `dealer.status === ACTIVE` as well as an approved
    // listing (Rule 6).
    const data = await apiSend<DealerModerationResponse>(
      'POST',
      `/v1/admin/dealers/${dealerId}/suspend`,
      parsed.data,
    );
    refreshAdmin();
    return { ok: true, data };
  } catch (error) {
    return fail(error, 'We could not suspend that dealer.');
  }
}

export async function grantCreditsAction(
  dealerId: string,
  input: unknown,
): Promise<AdminResult<GrantCreditsResponse>> {
  const parsed = GrantCreditsInput.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: 'A grant needs a credit count and a reason.' };
  }

  try {
    const data = await apiSend<GrantCreditsResponse>(
      'POST',
      `/v1/admin/dealers/${dealerId}/credits/grant`,
      parsed.data,
    );
    refreshAdmin();
    return { ok: true, data };
  } catch (error) {
    return fail(error, 'We could not grant those credits.');
  }
}
