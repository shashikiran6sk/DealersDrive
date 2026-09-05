'use server';

import {
  ApproveDealerInput,
  NoteInput,
  ReasonInput,
  type DealerModerationResponse,
  type VerifyDocumentResponse,
} from '@dealers-drive/contracts';
import { revalidatePath } from 'next/cache';

import { ApiError, apiSend } from '@/lib/api';

/**
 * Admin moderation (D4, D6, D9–D12).
 *
 * These are the actions that move credits and change what the public can see.
 * Approving a dealership is the one that matters most here: public visibility
 * requires `dealer.status === 'ACTIVE'` as well as an approved listing, so this
 * single write is what puts a dealership's whole catalogue in front of buyers —
 * and suspending is what takes all of it away again, at once (rule 6).
 *
 * Every action re-parses its input against the same contract the API validates
 * with, before the request leaves. That is not belt-and-braces: it turns a
 * typo'd field into a message in the form rather than a 400 the user has to
 * interpret, and it is free, because the schema already exists.
 *
 * ── Reconstruction slice ────────────────────────────────────────────────────
 * The baseline file also carries the four listing decisions (**F070**, F071)
 * and `grantCreditsAction` (**F054**). Each lands with the endpoint it calls.
 *
 * `reinstateDealerAction` and the two document decisions are **not** ports.
 * The baseline console called none of them: the endpoints existed and were
 * documented, and nothing in the UI reached them. That left two dead ends a
 * moderator could walk into and not walk out of. A suspended dealership could
 * only be brought back through the API, and — worse — a document could only be
 * *verified* through the API, which meant `canApprove` (which requires all
 * three verified) was never true and the approve button never appeared at all.
 * The three actions below are what make the console's own state machine
 * traversable.
 * ────────────────────────────────────────────────────────────────────────────
 */
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

function refreshAdmin(): void {
  revalidatePath('/admin', 'layout');
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

/**
 * Suspension is not a terminal state, and the console should not treat it as
 * one. This is the way back: SUSPENDED → ACTIVE, which restores every listing
 * the suspension pulled out of the catalogue (rule 6).
 */
export async function reinstateDealerAction(
  dealerId: string,
  input: unknown,
): Promise<AdminResult<DealerModerationResponse>> {
  const parsed = NoteInput.safeParse(input ?? {});
  if (!parsed.success) return { ok: false, message: 'That note is not valid.' };

  try {
    const data = await apiSend<DealerModerationResponse>(
      'POST',
      `/v1/admin/dealers/${dealerId}/reinstate`,
      parsed.data,
    );
    refreshAdmin();
    return { ok: true, data };
  } catch (error) {
    return fail(error, 'We could not reinstate that dealer.');
  }
}

/**
 * D5. The two KYC decisions.
 *
 * Approving a dealership requires all three documents verified, and verifying
 * one was previously an API-only action — so the approve control was
 * unreachable from the console by construction. These are what close that loop.
 */
export async function verifyDocumentAction(
  documentId: string,
): Promise<AdminResult<VerifyDocumentResponse>> {
  try {
    const data = await apiSend<VerifyDocumentResponse>(
      'POST',
      `/v1/admin/documents/${documentId}/verify`,
    );
    refreshAdmin();
    return { ok: true, data };
  } catch (error) {
    return fail(error, 'We could not verify that document.');
  }
}

export async function rejectDocumentAction(
  documentId: string,
  input: unknown,
): Promise<AdminResult<VerifyDocumentResponse>> {
  const parsed = ReasonInput.safeParse(input);
  // The dealer reads this verbatim and re-uploads against it, so it is the one
  // field on this screen that cannot be left to a default.
  if (!parsed.success) return { ok: false, message: 'A rejection needs a reason.' };

  try {
    const data = await apiSend<VerifyDocumentResponse>(
      'POST',
      `/v1/admin/documents/${documentId}/reject`,
      parsed.data,
    );
    refreshAdmin();
    return { ok: true, data };
  } catch (error) {
    return fail(error, 'We could not reject that document.');
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
