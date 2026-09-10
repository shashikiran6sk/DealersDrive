/**
 * A stand-in for `@/features/auth/phone-actions` (**R39**).
 *
 * Coupling **C-4**: `PhoneVerification` calls two Server Actions, and the
 * sandbox has no server. `.storybook/main.ts` aliases the real module to this
 * one, the same way `auth-actions.ts` stands in for the onboarding writes.
 *
 * The Firebase half is stubbed separately — see `phone-firebase.ts`. The two
 * are deliberately not one file: a story that wants to show *"the number is
 * already registered"* is exercising the API's refusal and must never reach
 * Firebase, and a story showing a wrong code is exercising Firebase's while the
 * API is never called. Collapsing them would make either impossible to stage.
 */
export interface PhoneState {
  phone?: string;
  phoneDisplay?: string;
  verified?: boolean;
  error?: string;
  fieldError?: string;
}

/** What the sandbox's phone actions do next. Set by a story before it renders. */
export const phoneActionStub: {
  delayMs: number;
  start: PhoneState;
  verify: PhoneState;
  calls: { action: string; value: string }[];
} = {
  delayMs: 600,
  start: { phone: '+919840012345', phoneDisplay: '+91 98400 12345' },
  verify: { verified: true, phone: '+919840012345', phoneDisplay: '+91 98400 12345' },
  calls: [],
};

export async function startPhoneVerificationAction(phone: string): Promise<PhoneState> {
  phoneActionStub.calls.push({ action: 'start', value: phone });
  await new Promise((resolve) => setTimeout(resolve, phoneActionStub.delayMs));
  return phoneActionStub.start;
}

export async function verifyPhoneAction(idToken: string): Promise<PhoneState> {
  phoneActionStub.calls.push({ action: 'verify', value: idToken });
  await new Promise((resolve) => setTimeout(resolve, phoneActionStub.delayMs));
  return phoneActionStub.verify;
}
