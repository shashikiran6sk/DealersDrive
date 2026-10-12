'use server';

import { ReasonInput, type PortfolioDecisionResponse } from '@dealers-drive/contracts';
import { revalidatePath } from 'next/cache';

import { ApiError, apiSend } from '@/lib/api';
import { revalidatePublicDealer } from '@/lib/cache-tags';

import { PORTFOLIO_ACTION_TEXT, PORTFOLIO_QUEUE_PATH } from './portfolio-actions.constants';

export interface PortfolioActionResult {
  ok: boolean;
  message?: string;
  decision?: PortfolioDecisionResponse;
}

async function decide(
  path: string,
  body: unknown,
  fallback: string,
  dealerSlug?: string,
): Promise<PortfolioActionResult> {
  try {
    const decision = await apiSend<PortfolioDecisionResponse>('POST', path, body);
    revalidatePath(PORTFOLIO_QUEUE_PATH);
    revalidatePath('/admin', 'layout');
    revalidatePublicDealer(dealerSlug);
    return { ok: true, decision };
  } catch (error) {
    if (error instanceof ApiError) {
      return { ok: false, message: error.userMessage(error.problem.title) };
    }
    return { ok: false, message: fallback };
  }
}

export async function approvePortfolioPhotoAction(
  photoId: string,
  dealerSlug?: string,
): Promise<PortfolioActionResult> {
  return decide(
    `/v1/admin/portfolio/${encodeURIComponent(photoId)}/approve`,
    {},
    PORTFOLIO_ACTION_TEXT.approveFailed,
    dealerSlug,
  );
}

export async function rejectPortfolioPhotoAction(
  photoId: string,
  reason: string,
  dealerSlug?: string,
): Promise<PortfolioActionResult> {
  const parsed = ReasonInput.safeParse({ reason });
  if (!parsed.success) return { ok: false, message: PORTFOLIO_ACTION_TEXT.needReason };
  return decide(
    `/v1/admin/portfolio/${encodeURIComponent(photoId)}/reject`,
    parsed.data,
    PORTFOLIO_ACTION_TEXT.rejectFailed,
    dealerSlug,
  );
}

export async function takeDownPortfolioPhotoAction(
  photoId: string,
  reason: string,
  dealerSlug?: string,
): Promise<PortfolioActionResult> {
  const parsed = ReasonInput.safeParse({ reason });
  if (!parsed.success) return { ok: false, message: PORTFOLIO_ACTION_TEXT.needReason };
  return decide(
    `/v1/admin/portfolio/${encodeURIComponent(photoId)}/take-down`,
    parsed.data,
    PORTFOLIO_ACTION_TEXT.takeDownFailed,
    dealerSlug,
  );
}
