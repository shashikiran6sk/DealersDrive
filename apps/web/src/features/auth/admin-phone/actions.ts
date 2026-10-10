'use server';

import {
  AdminPhoneChallengeInput,
  AdminPhoneVerifyInput,
  type AdminPhoneChallengeResponse,
} from '@dealers-drive/contracts';
import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { ADMIN_SESSION_COOKIE, ApiError, apiSend } from '@/lib/api';
import { serverConfig } from '@/lib/config';
import { relaySessionCookie } from '@/lib/session-cookie';

export async function startAdminPhoneChallenge(
  mode: 'LOGIN' | 'ENROLL',
  phone: string,
): Promise<{ challenge?: AdminPhoneChallengeResponse; error?: string }> {
  const parsed = AdminPhoneChallengeInput.safeParse({ phone });
  if (!parsed.success) return { error: 'Enter a valid Indian mobile number.' };
  try {
    const path =
      mode === 'LOGIN'
        ? '/v1/auth/admin/phone/challenge'
        : '/v1/admin/profile/security/phone/challenge';
    return {
      challenge: await apiSend<AdminPhoneChallengeResponse>('POST', path, parsed.data, {
        headers: { Origin: serverConfig().webBaseUrl },
      }),
    };
  } catch (error) {
    return {
      error:
        error instanceof ApiError
          ? error.userMessage()
          : 'Mobile verification is unavailable. Please try again.',
    };
  }
}

export async function verifyAdminPhone(
  mode: 'LOGIN' | 'ENROLL',
  input: unknown,
): Promise<{ error?: string }> {
  const parsed = AdminPhoneVerifyInput.safeParse(input);
  if (!parsed.success) return { error: 'Start mobile verification again.' };
  let setCookies: readonly string[] = [];
  try {
    const path =
      mode === 'LOGIN' ? '/v1/auth/admin/phone/verify' : '/v1/admin/profile/security/phone/verify';
    await apiSend('POST', path, parsed.data, {
      headers: { Origin: serverConfig().webBaseUrl },
      onSetCookie: (values) => {
        setCookies = values;
      },
    });
    if (mode === 'LOGIN' && !(await relaySessionCookie(setCookies, true)))
      return { error: 'The admin session could not be established. Please try again.' };
  } catch (error) {
    return {
      error:
        error instanceof ApiError
          ? error.userMessage()
          : 'Mobile verification is unavailable. Please try again.',
    };
  }
  revalidatePath('/admin/profile/security');
  if (mode === 'LOGIN') redirect('/admin');
  return {};
}

export async function revokeAdminPhone(formData: FormData): Promise<void> {
  if (formData.get('confirm') !== 'on') return;
  try {
    await apiSend(
      'POST',
      '/v1/admin/profile/security/phone/revoke',
      { confirm: true },
      { headers: { Origin: serverConfig().webBaseUrl } },
    );
  } catch (error) {
    if (error instanceof ApiError && error.code === 'ADMIN_GOOGLE_REAUTH_REQUIRED')
      redirect('/admin/profile/security?error=reauthenticate');
    redirect('/admin/profile/security?error=revoke_failed');
  }
  (await cookies()).delete(ADMIN_SESSION_COOKIE);
  redirect('/admin/login?error=mobile_revoked');
}
