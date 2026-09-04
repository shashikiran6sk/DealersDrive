'use server';

import {
  ApproveDealerInput,
  ReasonInput,
  type DealerModerationResponse,
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
 * There is deliberately no `rejectDealerAction` or `reinstateDealerAction`.
 * Both endpoints exist and are documented, but **the baseline console calls
 * neither** — `DealerAdminActions` renders an approve control and a suspend
 * control and nothing else, so those two routes are reachable only through the
 * API reference. Adding buttons for them would be new product work rather than
 * a port; it is noted in the feature-map entry instead.
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
