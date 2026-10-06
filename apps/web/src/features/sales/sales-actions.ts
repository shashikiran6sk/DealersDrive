'use server';

import {
  CreateAssistedDealerInput,
  SalesPhoneVerifyInput,
  UpdateAssistedDealerInput,
  type DealerSubmitResponse,
  type SalesDealerDetail,
  type SalesPhoneVerifyResponse,
} from '@dealers-drive/contracts';
import { revalidatePath } from 'next/cache';

import type { PhoneVerificationState } from '@/features/auth/phone-actions';
import { ApiError, apiSend } from '@/lib/api';

import { SALES_ACTION_TEXT } from './sales-actions.constants';

export interface SalesActionResult {
  ok: boolean;
  message?: string;
  fieldErrors?: Record<string, string>;
  dealerId?: string;
}

function fieldErrorsOf(issues: readonly { path: readonly PropertyKey[]; message: string }[]) {
  const errors: Record<string, string> = {};
  for (const issue of issues) {
    const key = String(issue.path[0] ?? 'form');
    errors[key] ??= issue.message;
  }
  return errors;
}

function failure(error: unknown, fallback: string): SalesActionResult {
  if (error instanceof ApiError) {
    return {
      ok: false,
      message: error.userMessage(fallback),
      fieldErrors: error.fieldErrors(),
    };
  }
  return { ok: false, message: SALES_ACTION_TEXT.unavailable };
}

export async function verifyDealerPhoneAction(
  phone: string,
  accessToken: string,
  consent: boolean,
): Promise<PhoneVerificationState> {
  const parsed = SalesPhoneVerifyInput.safeParse({
    phone: phone.trim(),
    accessToken: accessToken.trim(),
    consent,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? SALES_ACTION_TEXT.verifyFailed };
  }
  try {
    const result = await apiSend<SalesPhoneVerifyResponse>(
      'POST',
      '/v1/sales/dealers/phone/verify',
      parsed.data,
    );
    return {
      verified: true,
      phone: result.phone,
      phoneDisplay: result.phoneDisplay,
      phoneTicket: result.phoneTicket,
    };
  } catch (error) {
    if (error instanceof ApiError)
      return { error: error.userMessage(SALES_ACTION_TEXT.verifyFailed) };
    return { error: SALES_ACTION_TEXT.unavailable };
  }
}

export async function createAssistedDealerAction(input: unknown): Promise<SalesActionResult> {
  const parsed = CreateAssistedDealerInput.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: SALES_ACTION_TEXT.invalid,
      fieldErrors: fieldErrorsOf(parsed.error.issues),
    };
  }
  try {
    const created = await apiSend<SalesDealerDetail>('POST', '/v1/sales/dealers', parsed.data);
    revalidatePath('/sales');
    return { ok: true, dealerId: created.id };
  } catch (error) {
    return failure(error, SALES_ACTION_TEXT.createFailed);
  }
}

export async function updateAssistedDealerAction(
  dealerId: string,
  input: unknown,
): Promise<SalesActionResult> {
  const parsed = UpdateAssistedDealerInput.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: SALES_ACTION_TEXT.invalid,
      fieldErrors: fieldErrorsOf(parsed.error.issues),
    };
  }
  try {
    await apiSend<SalesDealerDetail>(
      'PATCH',
      `/v1/sales/dealers/${encodeURIComponent(dealerId)}`,
      parsed.data,
    );
    revalidatePath(`/sales/dealers/${dealerId}`);
    return { ok: true, dealerId };
  } catch (error) {
    return failure(error, SALES_ACTION_TEXT.updateFailed);
  }
}

export async function submitAssistedDealerAction(dealerId: string): Promise<SalesActionResult> {
  try {
    await apiSend<DealerSubmitResponse>(
      'POST',
      `/v1/sales/dealers/${encodeURIComponent(dealerId)}/submit`,
    );
    revalidatePath(`/sales/dealers/${dealerId}`);
    revalidatePath('/sales');
    return { ok: true, dealerId };
  } catch (error) {
    return failure(error, SALES_ACTION_TEXT.submitFailed);
  }
}
