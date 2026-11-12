'use server';

import { AdminCreditAdjustmentInput, Uuid } from '@dealers-drive/contracts';
import { revalidatePath } from 'next/cache';

import type { ActionResult } from '@/types';
import { ApiError, apiSend } from '@/lib/api';

import { DEALER_CREDITS_TEXT } from './dealer-credits/dealer-credits.constants';

export async function adjustDealerCreditsAction(
  dealerId: string,
  credits: number,
  note: string,
): Promise<ActionResult> {
  const id = Uuid.safeParse(dealerId);
  const input = AdminCreditAdjustmentInput.safeParse({ credits, note });
  if (!id.success || !input.success) return { ok: false, message: DEALER_CREDITS_TEXT.invalid };
  try {
    await apiSend('POST', `/v1/admin/dealers/${encodeURIComponent(id.data)}/credits`, input.data);
    revalidatePath(`/admin/dealers/${id.data}`);
    return { ok: true, message: DEALER_CREDITS_TEXT.saved };
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof ApiError
          ? error.userMessage(DEALER_CREDITS_TEXT.failed)
          : DEALER_CREDITS_TEXT.failed,
    };
  }
}
