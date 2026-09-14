export interface PhoneVerificationState {
  verified?: boolean;
  phone?: string;
  phoneDisplay?: string;
  error?: string;
}

export const phoneActionStub: {
  delayMs: number;
  result: PhoneVerificationState;
  availability: { error?: string };
  calls: { phone: string; accessToken: string }[];
  availabilityChecks: string[];
} = {
  delayMs: 600,
  result: { verified: true },
  availability: {},
  calls: [],
  availabilityChecks: [],
};

export async function checkPhoneAvailabilityAction(phone: string): Promise<{ error?: string }> {
  phoneActionStub.availabilityChecks.push(phone);
  await new Promise((resolve) => setTimeout(resolve, 150));
  return phoneActionStub.availability;
}

export async function verifyPhoneAction(
  phone: string,
  accessToken: string,
): Promise<PhoneVerificationState> {
  phoneActionStub.calls.push({ phone, accessToken });
  await new Promise((resolve) => setTimeout(resolve, phoneActionStub.delayMs));
  return { phone: `+91${phone.replace(/\D/g, '').slice(-10)}`, ...phoneActionStub.result };
}
