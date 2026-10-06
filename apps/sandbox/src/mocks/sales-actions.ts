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
