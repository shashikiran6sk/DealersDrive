import type { PhoneVerificationState } from '@/features/auth/phone-actions';

export interface SalesActionResult {
  ok: boolean;
  message?: string;
  fieldErrors?: Record<string, string>;
  dealerId?: string;
}

export const salesActionStub: {
  delayMs: number;
  result: SalesActionResult;
  calls: string[];
} = {
  delayMs: 600,
  result: { ok: true, dealerId: 'd-1' },
  calls: [],
};

async function settle(call: string): Promise<SalesActionResult> {
  salesActionStub.calls.push(call);
  await new Promise((resolve) => setTimeout(resolve, salesActionStub.delayMs));
  return salesActionStub.result;
}

export async function verifyDealerPhoneAction(
  phone: string,
  _accessToken: string,
  consent: boolean,
): Promise<PhoneVerificationState> {
  salesActionStub.calls.push(`verify ${phone} consent=${String(consent)}`);
  await new Promise((resolve) => setTimeout(resolve, salesActionStub.delayMs));
  return { verified: true, phone: `+91${phone}`, phoneTicket: 'sandbox-ticket' };
}

export function createAssistedDealerAction(input: unknown): Promise<SalesActionResult> {
  return settle(`create ${JSON.stringify(input)}`);
}

export function updateAssistedDealerAction(
  dealerId: string,
  input: unknown,
): Promise<SalesActionResult> {
  return settle(`update ${dealerId} ${JSON.stringify(input)}`);
}

export function submitAssistedDealerAction(dealerId: string): Promise<SalesActionResult> {
  return settle(`submit ${dealerId}`);
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

export const emailCodeStub: {
  sendResult: EmailCodeResult | null;
  verifyResult: EmailVerifyResult | null;
  correctCode: string;
} = {
  sendResult: null,
  verifyResult: null,
  correctCode: '123456',
};

export async function sendDealerEmailCodeAction(email: string): Promise<EmailCodeResult> {
  salesActionStub.calls.push(`email code ${email}`);
  await new Promise((resolve) => setTimeout(resolve, salesActionStub.delayMs));
  return (
    emailCodeStub.sendResult ?? {
      ok: true,
      email: email.trim().toLowerCase(),
      challenge: 'sandbox-challenge',
      resendAfterSeconds: 60,
    }
  );
}

export async function verifyDealerEmailAction(
  challenge: string,
  code: string,
): Promise<EmailVerifyResult> {
  salesActionStub.calls.push(`email verify ${challenge} ${code}`);
  await new Promise((resolve) => setTimeout(resolve, salesActionStub.delayMs));
  if (emailCodeStub.verifyResult) return emailCodeStub.verifyResult;
  return code === emailCodeStub.correctCode
    ? { ok: true, email: 'selvi@gmail.com', emailTicket: 'sandbox-email-ticket' }
    : { ok: false, message: 'That code is not right. Check the email and try again.' };
}

export function verifyAssistedDealerOwnerAction(
  dealerId: string,
  input: unknown,
): Promise<SalesActionResult> {
  return settle(`verify owner ${dealerId} ${JSON.stringify(input)}`);
}
