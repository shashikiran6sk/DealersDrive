/**
 * A stand-in for `@/features/auth/phone-actions` (**R39**).
 *
 * Coupling **C-4** in `component-map.md`, for the same reason the auth actions
 * have one: `PhoneVerification` posts the widget's access token through a
 * Server Action, and the sandbox has no server. `.storybook/main.ts` aliases
 * the real module to this one.
 *
 * What it must *not* do is decide anything the real endpoint decides. The
 * component under test is the one that hands a token over and renders what
 * comes back — so this stub answers, slowly enough to see, whatever the story
 * set.
 */
export interface PhoneVerificationState {
  verified?: boolean;
  phone?: string;
  phoneDisplay?: string;
  error?: string;
}

/** What the sandbox's verification answers. Set by a story before it renders. */
export const phoneActionStub: {
  delayMs: number;
  result: PhoneVerificationState;
  calls: { phone: string; accessToken: string }[];
} = {
  delayMs: 600,
  result: { verified: true },
  calls: [],
};

export async function verifyPhoneAction(
  phone: string,
  accessToken: string,
): Promise<PhoneVerificationState> {
  phoneActionStub.calls.push({ phone, accessToken });
  await new Promise((resolve) => setTimeout(resolve, phoneActionStub.delayMs));
  return { phone: `+91${phone.replace(/\D/g, '').slice(-10)}`, ...phoneActionStub.result };
}
