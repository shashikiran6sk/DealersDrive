'use server';

import {
  CreateAssistedDealerInput,
  SalesEmailCodeInput,
  SalesEmailVerifyInput,
  SalesPhoneVerifyInput,
  UpdateAssistedDealerInput,
  VerifyAssistedDealerInput,
  type DealerSubmitResponse,
  type SalesDealerDetail,
  type SalesEmailCodeResponse,
  type SalesEmailVerifyResponse,
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

export interface EmailCodeResult {
  ok: boolean;
  email?: string;
  challenge?: string;
  resendAfterSeconds?: number;
  message?: string;
}

export interface EmailVerifyResult {
  ok: boolean;
  email?: string;
  emailTicket?: string;
  message?: string;
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

export async function sendDealerEmailCodeAction(email: string): Promise<EmailCodeResult> {
  const parsed = SalesEmailCodeInput.safeParse({ email });
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? SALES_ACTION_TEXT.invalid };
  }
  try {
    const result = await apiSend<SalesEmailCodeResponse>(
      'POST',
      '/v1/sales/dealers/email/code',
      parsed.data,
    );
    return {
      ok: true,
      email: result.email,
      challenge: result.challenge,
      resendAfterSeconds: result.resendAfterSeconds,
    };
  } catch (error) {
    if (error instanceof ApiError) {
      return {
        ok: false,
        message:
          error.status === 503
            ? SALES_ACTION_TEXT.emailSendFailed
            : error.userMessage(SALES_ACTION_TEXT.emailSendFailed),
      };
    }
    return { ok: false, message: SALES_ACTION_TEXT.unavailable };
  }
}

export async function verifyDealerEmailAction(
  challenge: string,
  code: string,
): Promise<EmailVerifyResult> {
  const parsed = SalesEmailVerifyInput.safeParse({ challenge, code });
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? SALES_ACTION_TEXT.emailVerifyFailed,
    };
  }
  try {
    const result = await apiSend<SalesEmailVerifyResponse>(
      'POST',
      '/v1/sales/dealers/email/verify',
      parsed.data,
    );
    return { ok: true, email: result.email, emailTicket: result.emailTicket };
  } catch (error) {
    if (error instanceof ApiError) {
      return { ok: false, message: error.userMessage(SALES_ACTION_TEXT.emailVerifyFailed) };
    }
    return { ok: false, message: SALES_ACTION_TEXT.unavailable };
  }
}

export async function verifyAssistedDealerOwnerAction(
  dealerId: string,
  input: unknown,
): Promise<SalesActionResult> {
  const parsed = VerifyAssistedDealerInput.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: SALES_ACTION_TEXT.ownerVerifyFailed,
      fieldErrors: fieldErrorsOf(parsed.error.issues),
    };
  }
  try {
    await apiSend<SalesDealerDetail>(
      'POST',
      `/v1/sales/dealers/${encodeURIComponent(dealerId)}/verify`,
      parsed.data,
    );
    revalidatePath(`/sales/dealers/${dealerId}`);
    revalidatePath('/sales');
    return { ok: true, dealerId };
  } catch (error) {
    return failure(error, SALES_ACTION_TEXT.ownerVerifyFailed);
  }
}
