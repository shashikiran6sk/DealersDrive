'use server';

import {
  TermsAcceptanceInput,
  type AgreementAcceptance,
  CustomerName,
  CustomerSignInInput,
  PhoneSignInInput,
  type CustomerSession,
  type CustomerSignInResponse,
  type PhoneSignInResponse,
  CustomerReactivationInput,
  Uuid,
  CUSTOMER_ACCOUNT_TEXT,
} from '@dealers-drive/contracts';
import { cookies } from 'next/headers';

import { legalEnforcementEnabled } from '@/lib/legal-release';
import { ApiError, apiSend, SESSION_COOKIE } from '@/lib/api';
import { writeAuthHint } from '@/lib/auth-hint-cookie';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { relaySessionCookie } from '@/lib/session-cookie';

import {
  SIGN_IN_ACTION_TEXT,
  SIGN_UP_COOKIE,
  SIGN_UP_TTL_SECONDS,
  REACTIVATION_COOKIE,
} from './sign-in-actions.constants';

export interface DealerSignInState {
  returnTo?: string;
  error?: string;
}

export interface CustomerSignInState {
  status?: 'SIGNED_IN' | 'NAME_REQUIRED' | 'REACTIVATION_REQUIRED';
  reactivationId?: string;
  fullName?: string;
  phoneDisplay?: string;
  error?: string;
}

export interface CustomerSignUpState {
  done?: boolean;
  error?: string;
  fieldError?: string;
}

export async function dealerPhoneSignInAction(
  phone: string,
  accessToken: string,
  returnTo?: string,
): Promise<DealerSignInState> {
  const parsed = PhoneSignInInput.safeParse({
    phone: phone.trim(),
    accessToken: accessToken.trim(),
    ...(returnTo ? { returnTo } : {}),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? SIGN_IN_ACTION_TEXT.notVerified };
  }

  let setCookies: string[] = [];
  try {
    const result = await apiSend<PhoneSignInResponse>(
      'POST',
      '/v1/auth/sign-in/phone/dealer',
      parsed.data,
      { onSetCookie: (received) => (setCookies = received) },
    );
    if (!(await relaySessionCookie(setCookies))) return { error: SIGN_IN_ACTION_TEXT.noSession };
    return { returnTo: result.returnTo };
  } catch (error) {
    return { error: messageOf(error, SIGN_IN_ACTION_TEXT.notVerified) };
  }
}

export async function customerPhoneSignInAction(
  phone: string,
  accessToken: string,
): Promise<CustomerSignInState> {
  const parsed = CustomerSignInInput.safeParse({
    phone: phone.trim(),
    accessToken: accessToken.trim(),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? SIGN_IN_ACTION_TEXT.notVerified };
  }

  let setCookies: string[] = [];
  try {
    const result = await apiSend<CustomerSignInResponse>(
      'POST',
      '/v1/auth/sign-in/phone/customer',
      parsed.data,
      { onSetCookie: (received) => (setCookies = received) },
    );

    if (result.status === 'NAME_REQUIRED' && result.signUpToken) {
      (await cookies()).delete(REACTIVATION_COOKIE);
      (await cookies()).set(SIGN_UP_COOKIE, result.signUpToken, {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        maxAge: SIGN_UP_TTL_SECONDS,
      });
      return { status: 'NAME_REQUIRED', phoneDisplay: result.phoneDisplay };
    }
    if (result.status === 'REACTIVATION_REQUIRED' && result.reactivationToken) {
      const jar = await cookies();
      const flowId = randomUUID();
      jar.delete(SESSION_COOKIE);
      jar.delete(SIGN_UP_COOKIE);
      await writeAuthHint(false);
      jar.set(REACTIVATION_COOKIE, JSON.stringify({ token: result.reactivationToken, flowId }), {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        path: '/',
        maxAge: SIGN_UP_TTL_SECONDS,
      });
      return {
        status: 'REACTIVATION_REQUIRED',
        reactivationId: flowId,
        phoneDisplay: result.phoneDisplay,
        fullName: result.reactivationName,
      };
    }

    if (!(await relaySessionCookie(setCookies))) return { error: SIGN_IN_ACTION_TEXT.noSession };
    (await cookies()).delete(REACTIVATION_COOKIE);
    (await cookies()).delete(REACTIVATION_COOKIE);
    return {
      status: 'SIGNED_IN',
      phoneDisplay: result.phoneDisplay,
      ...(result.customer ? { fullName: result.customer.fullName } : {}),
    };
  } catch (error) {
    return { error: messageOf(error, SIGN_IN_ACTION_TEXT.notVerified) };
  }
}

export async function customerSignUpAction(
  fullName: string,
  agreement?: AgreementAcceptance,
): Promise<CustomerSignUpState> {
  if (agreement && !legalEnforcementEnabled())
    return { error: 'Agreement collection has changed. Refresh before continuing.' };
  if (legalEnforcementEnabled() && !TermsAcceptanceInput.safeParse(agreement).success)
    return { error: 'Accept the Terms and acknowledge the Privacy Policy to create your account.' };
  const name = CustomerName.safeParse(fullName);
  if (!name.success) {
    return { fieldError: name.error.issues[0]?.message ?? SIGN_IN_ACTION_TEXT.nameRequired };
  }

  const jar = await cookies();
  const signUpToken = jar.get(SIGN_UP_COOKIE)?.value;
  if (!signUpToken) return { error: SIGN_IN_ACTION_TEXT.startAgain };

  let setCookies: string[] = [];
  try {
    await apiSend<CustomerSession>(
      'POST',
      '/v1/auth/sign-up/customer',
      { signUpToken, fullName: name.data, ...(legalEnforcementEnabled() ? { agreement } : {}) },
      { onSetCookie: (received) => (setCookies = received) },
    );
  } catch (error) {
    if (error instanceof ApiError && error.code === 'SIGN_UP_EXPIRED') {
      jar.delete(SIGN_UP_COOKIE);
      return { error: SIGN_IN_ACTION_TEXT.startAgain };
    }
    const fieldError = error instanceof ApiError ? error.fieldErrors().fullName : undefined;
    if (fieldError) return { fieldError };
    return { error: messageOf(error, SIGN_IN_ACTION_TEXT.signUpFailed) };
  }

  jar.delete(SIGN_UP_COOKIE);
  jar.delete(REACTIVATION_COOKIE);
  if (!(await relaySessionCookie(setCookies))) return { error: SIGN_IN_ACTION_TEXT.noSession };
  return { done: true };
}

export async function customerReactivateAction(flowId: string): Promise<CustomerSignUpState> {
  const jar = await cookies();
  if (!Uuid.safeParse(flowId).success || jar.get(SESSION_COOKIE)?.value)
    return { error: SIGN_IN_ACTION_TEXT.startAgain };
  let stored: unknown;
  try {
    stored = JSON.parse(jar.get(REACTIVATION_COOKIE)?.value ?? 'null');
  } catch {
    return { error: SIGN_IN_ACTION_TEXT.startAgain };
  }
  const ticket = z
    .object({ flowId: Uuid, token: z.string().min(1).max(2048) })
    .strict()
    .safeParse(stored);
  if (!ticket.success || ticket.data.flowId !== flowId)
    return { error: SIGN_IN_ACTION_TEXT.startAgain };
  const input = CustomerReactivationInput.parse({
    reactivationToken: ticket.data.token,
    confirmed: true,
  });
  let setCookies: string[] = [];
  try {
    await apiSend<CustomerSession>('POST', '/v1/auth/customer/reactivate', input, {
      onSetCookie: (received) => (setCookies = received),
    });
    if (!(await relaySessionCookie(setCookies))) return { error: SIGN_IN_ACTION_TEXT.noSession };
    jar.delete(REACTIVATION_COOKIE);
    return { done: true };
  } catch (error) {
    if (error instanceof ApiError && error.code === 'CUSTOMER_REACTIVATION_EXPIRED')
      jar.delete(REACTIVATION_COOKIE);
    return { error: messageOf(error, CUSTOMER_ACCOUNT_TEXT.failed) };
  }
}

function messageOf(error: unknown, fallback: string): string {
  if (error instanceof ApiError) return error.userMessage(fallback);
  return SIGN_IN_ACTION_TEXT.apiUnavailable;
}
