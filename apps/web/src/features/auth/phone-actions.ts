'use server';

import {
  PhoneAvailabilityInput,
  VerifyPhoneInput,
  type VerifyPhoneResponse,
} from '@dealers-drive/contracts';
import { revalidatePath } from 'next/cache';

import { ApiError, apiSend } from '@/lib/api';

export interface PhoneVerificationState {
  verified?: boolean;
  phone?: string;
  phoneDisplay?: string;
  error?: string;
}

export async function verifyPhoneAction(
  phone: string,
  accessToken: string,
): Promise<PhoneVerificationState> {
  const parsed = VerifyPhoneInput.safeParse({
    phone: phone.trim(),
    accessToken: accessToken.trim(),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'That number could not be verified.' };
  }

  let result: VerifyPhoneResponse;
  try {
    result = await apiSend<VerifyPhoneResponse>('POST', '/v1/auth/phone/verify', parsed.data);
  } catch (error) {
    if (error instanceof ApiError) {
      return { error: error.userMessage('That code could not be verified.') };
    }
    return { error: 'The API is unavailable. Try again shortly.' };
  }

  revalidatePath('/dealer/onboarding');

  return { verified: true, phone: result.phone, phoneDisplay: result.phoneDisplay };
}

export async function checkPhoneAvailabilityAction(phone: string): Promise<{ error?: string }> {
  const parsed = PhoneAvailabilityInput.safeParse({ phone: phone.trim() });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Enter a 10-digit Indian mobile number.' };
  }

  try {
    await apiSend<void>('POST', '/v1/auth/phone/availability', parsed.data);
  } catch (error) {
    if (error instanceof ApiError) {
      return { error: error.userMessage('That number could not be checked.') };
    }
    return { error: 'The API is unavailable. Try again shortly.' };
  }

  return {};
}
