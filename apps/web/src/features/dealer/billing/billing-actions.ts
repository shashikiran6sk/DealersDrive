'use server';

import {
  CreateCreditOrderInput,
  CreditCheckout,
  CreditOrderResult,
  Uuid,
  VerifyCreditOrderInput,
} from '@dealers-drive/contracts';
import { revalidatePath } from 'next/cache';

import { ApiError, apiSend } from '@/lib/api';

import { BILLING_HREF, BILLING_TEXT } from './billing.constants';

export type ActionOutcome<T> = { ok: true; value: T } | { ok: false; message: string };

function failed(error: unknown, fallback: string): { ok: false; message: string } {
  return { ok: false, message: error instanceof ApiError ? error.userMessage(fallback) : fallback };
}

export async function createCreditOrderAction(
  packId: string,
): Promise<ActionOutcome<CreditCheckout>> {
  const input = CreateCreditOrderInput.safeParse({ packId });
  if (!input.success) return { ok: false, message: BILLING_TEXT.failed };
  try {
    const raw = await apiSend<unknown>('POST', '/v1/dealer/billing/orders', input.data);
    const parsed = CreditCheckout.safeParse(raw);
    return parsed.success
      ? { ok: true, value: parsed.data }
      : { ok: false, message: BILLING_TEXT.failed };
  } catch (error) {
    return failed(error, BILLING_TEXT.failed);
  }
}

export async function verifyCreditOrderAction(
  orderId: string,
  payment: VerifyCreditOrderInput,
): Promise<ActionOutcome<CreditOrderResult>> {
  const id = Uuid.safeParse(orderId);
  const input = VerifyCreditOrderInput.safeParse(payment);
  if (!id.success || !input.success) return { ok: false, message: BILLING_TEXT.failed };
  try {
    const raw = await apiSend<unknown>(
      'POST',
      `/v1/dealer/billing/orders/${encodeURIComponent(id.data)}/verify`,
      input.data,
    );
    const parsed = CreditOrderResult.safeParse(raw);
    revalidatePath(BILLING_HREF);
    return parsed.success
      ? { ok: true, value: parsed.data }
      : { ok: false, message: BILLING_TEXT.pending };
  } catch (error) {
    return failed(error, BILLING_TEXT.failed);
  }
}
