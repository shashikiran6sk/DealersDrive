/** Server-action seam for the onboarding phone stories. No real SMS. */
export interface PhoneState {
  phone?: string;
  phoneDisplay?: string;
  verified?: boolean;
  challengeId?: string;
  resendAfterSeconds?: number;
  error?: string;
  fieldError?: string;
}
export const phoneActionStub: {
  delayMs: number;
  start: PhoneState;
  verify: PhoneState;
  calls: { action: string; value: string }[];
} = {
  delayMs: 600,
  start: {
    phone: '+919840012345',
    phoneDisplay: '+91 98400 12345',
    challengeId: '10000000-0000-4000-8000-000000000001',
    resendAfterSeconds: 60,
  },
  verify: { verified: true, phone: '+919840012345', phoneDisplay: '+91 98400 12345' },
  calls: [],
};
export async function startPhoneVerificationAction(phone: string): Promise<PhoneState> {
  phoneActionStub.calls.push({ action: 'start', value: phone });
  await new Promise((resolve) => setTimeout(resolve, phoneActionStub.delayMs));
  return phoneActionStub.start;
}
export async function verifyPhoneAction(challengeId: string, code: string): Promise<PhoneState> {
  phoneActionStub.calls.push({ action: 'verify', value: challengeId });
  await new Promise((resolve) => setTimeout(resolve, phoneActionStub.delayMs));
  if (code !== '123456') return { error: 'That code is not right. Check it and try again.' };
  return phoneActionStub.verify;
}
