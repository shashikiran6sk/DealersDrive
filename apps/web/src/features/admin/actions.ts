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

/**
 * The console's own pages, and the public ones the decision just changed.
 *
 * The second half was missing, and on these paths it is the half that matters:
 * public visibility is `dealer.status === 'ACTIVE'` (rule 6), so a suspension
 * is the write that takes a dealership off the marketplace — and the portfolio
 * went on being served from Next's cache for up to ten minutes afterwards. A
 * dealership suspended for cause staying up for ten minutes is not untidiness.
 *
 * `slug` is passed in rather than read off the response because
 * `DealerModerationResponse` carries an id and no slug, and every caller is a
 * screen already rendering `AdminDealerDetail`. Omitting it still clears the
 * directory and the header, so a caller that forgets degrades to the old
 * behaviour on one page rather than breaking.
 */
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

/**
 * Suspension is not a terminal state, and the console should not treat it as
 * one. This is the way back: SUSPENDED → ACTIVE, which restores every listing
 * the suspension pulled out of the catalogue (rule 6).
 */
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

/**
 * D5. The two KYC decisions.
 *
 * Approving a dealership requires all three documents verified, and verifying
 * one was previously an API-only action — so the approve control was
 * unreachable from the console by construction. These are what close that loop.
 */
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
  // The dealer reads this verbatim and re-uploads against it, so it is the one
  // field on this screen that cannot be left to a default.
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

/**
 * The destructive refusal.
 *
 * It does not set a status — it deletes the application: the KYC scans and the
 * yard photograph go from storage, the dealership row goes with its documents
 * and its membership, and the applicant is left able to start onboarding afresh
 * as a first-time applicant.
 *
 * The dealership no longer exists when this returns, so the caller must
 * navigate away rather than refresh: `/admin/dealers/{id}` is a 404 from here
 * on. `requestDealerChangesAction` below is the reversible answer, and is the
 * one a moderator wants nine times in ten.
 */
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

/**
 * The reversible refusal: PENDING_APPROVAL → DRAFT with the reason attached.
 *
 * Nothing is deleted. The dealer signs in to their own form again, filled in,
 * with the reason at the top of it — which is what "the GST certificate is
 * unreadable" actually calls for, and what rejecting would answer by throwing a
 * real business's whole application away.
 */
export async function requestDealerChangesAction(
  dealerId: string,
  input: unknown,
  slug?: string,
): Promise<AdminResult<DealerModerationResponse>> {
  const parsed = ReasonInput.safeParse(input);
  // The dealer reads it verbatim and corrects against it, so it is the one
  // field on this control that cannot be left to a default.
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

/**
 * D3 — the console amending the dealer's own answers.
 *
 * Parsed against `UpdateDealerInput`, the same schema the API validates with
 * and the same one `PATCH /v1/dealer` takes, so a GSTIN the API would refuse is
 * marked against the box the admin typed it into rather than coming back as a
 * 400 to interpret.
 */
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
    // This one answers with the dealership, so the slug is the row that was
    // actually written rather than one the caller believed in.
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
    // Suspending hides every one of this dealer's listings at once: public
    // visibility requires `dealer.status === ACTIVE` as well as an approved
    // listing (Rule 6).
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

/**
 * D3b — publishing or refusing a dealer's proposed words (**R34**).
 *
 * Both actions clear the public pages off the **response**, not off a slug the
 * console was rendering with. `ProfileChangeDecisionResponse.dealerSlug` is the
 * row the API actually wrote, which is the only trustworthy answer to "which
 * portfolio changed" — a moderator with two tabs open would otherwise clear
 * whichever dealership they last looked at.
 *
 * A refusal clears them too, and that is not wasted work: nothing about the
 * dealership moved, but the console's own dealer list and the review card did,
 * and `refreshAdmin` is what re-renders those. The public tags being dropped as
 * well costs one re-fetch of a page that will come back identical.
 */
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
  /*
   * Re-parsed here as well as at the API, for the reason every action in this
   * file does it: a six-character floor enforced only server-side reaches the
   * moderator as a 400 they have to interpret. The floor itself is the point —
   * this sentence is the whole of what the dealer will be told.
   */
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
