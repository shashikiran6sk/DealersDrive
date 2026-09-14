'use server';

import {
  OnboardingInput,
  UpdateDealerInput,
  type AuthSession,
  type DealerSubmitResponse,
} from '@dealers-drive/contracts';
import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

import { ApiError, apiSend, SESSION_COOKIE } from '@/lib/api';
import { servicesOf } from '@/lib/services';

export interface ActionState {
  message?: string;
  errors?: Record<string, string>;
  values?: Record<string, string>;
  saved?: boolean;
}

const ONBOARDING_FIELDS = [
  'fullName',
  'phone',
  'legalName',
  'addressLine',
  'city',
  'district',
  'state',
  'pincode',
  'mapsUrl',
  'landline',
  'tagline',
  'specialities',
] as const;

export async function onboardingAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const values = Object.fromEntries(
    ONBOARDING_FIELDS.map((field) => [field, text(formData, field)]),
  );

  const parsed = OnboardingInput.safeParse({
    fullName: text(formData, 'fullName').trim(),
    phone: text(formData, 'phone').trim(),
    legalName: text(formData, 'legalName').trim(),
    addressLine: text(formData, 'addressLine').trim(),
    city: text(formData, 'city').trim(),
    district: text(formData, 'district').trim(),
    state: text(formData, 'state').trim(),
    pincode: text(formData, 'pincode').trim(),
    mapsUrl: text(formData, 'mapsUrl').trim(),
    landline: emptyToUndefined(text(formData, 'landline')),
    tagline: text(formData, 'tagline').trim(),
    specialities: servicesOf(text(formData, 'specialities')),
  });

  if (!parsed.success) {
    return { errors: fieldErrors(parsed.error.issues), values };
  }

  try {
    await apiSend<AuthSession>('POST', '/v1/auth/onboarding', parsed.data);
  } catch (error) {
    if (error instanceof ApiError) {
      return {
        message: error.userMessage('That could not be saved.'),
        errors: apiFieldErrors(error),
        values,
      };
    }
    return { message: 'The API is unavailable. Try again shortly.', values };
  }

  redirect('/dealer/onboarding?step=2');
}

export async function updateOnboardingAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const values = Object.fromEntries(
    ONBOARDING_FIELDS.map((field) => [field, text(formData, field)]),
  );

  const parsed = UpdateDealerInput.safeParse({
    legalName: text(formData, 'legalName').trim(),
    tagline: text(formData, 'tagline').trim(),
    specialities: servicesOf(text(formData, 'specialities')),
    contact: {
      fullName: text(formData, 'fullName').trim(),
      phone: text(formData, 'phone').trim(),
      landline: text(formData, 'landline').trim(),
    },
    address: {
      line: text(formData, 'addressLine').trim(),
      city: text(formData, 'city').trim(),
      district: text(formData, 'district').trim(),
      state: text(formData, 'state').trim(),
      pincode: text(formData, 'pincode').trim(),
      mapsUrl: text(formData, 'mapsUrl').trim(),
    },
  });

  if (!parsed.success) {
    return { errors: fieldErrors(parsed.error.issues), values };
  }

  try {
    await apiSend('PATCH', '/v1/dealer/onboarding', parsed.data);
  } catch (error) {
    if (error instanceof ApiError) {
      return {
        message: error.userMessage('That could not be saved.'),
        errors: apiFieldErrors(error),
        values,
      };
    }
    return { message: 'The API is unavailable. Try again shortly.', values };
  }

  redirect('/dealer/onboarding?step=2');
}

export async function signOutAction(scope: 'dealer' | 'admin' = 'dealer'): Promise<void> {
  const path = scope === 'admin' ? '/v1/auth/admin/logout' : '/v1/auth/logout';

  await apiSend<void>('POST', path).catch(() => undefined);

  (await cookies()).delete(SESSION_COOKIE);
  redirect(scope === 'admin' ? '/admin/login' : '/dealer/login');
}

export async function saveBusinessIdsAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const values = {
    gstin: text(formData, 'gstin').trim().toUpperCase(),
    pan: text(formData, 'pan').trim().toUpperCase(),
  };

  const parsed = UpdateDealerInput.safeParse(values);
  if (!parsed.success) return { errors: fieldErrors(parsed.error.issues), values };

  try {
    await apiSend('PATCH', '/v1/dealer/onboarding', parsed.data);
  } catch (error) {
    if (error instanceof ApiError) {
      return {
        message: error.userMessage('Those could not be saved.'),
        errors: apiFieldErrors(error),
        values,
      };
    }
    return { message: 'The API is unavailable. Try again shortly.', values };
  }

  revalidatePath('/dealer/onboarding');
  return { values, saved: true };
}

export async function submitForVerificationAction(): Promise<ActionState> {
  try {
    await apiSend<DealerSubmitResponse>('POST', '/v1/dealer/submit');
  } catch (error) {
    if (error instanceof ApiError) {
      return { message: error.userMessage('That could not be submitted yet.') };
    }
    return { message: 'The API is unavailable. Try again shortly.' };
  }

  redirect('/dealer/onboarding?step=3');
}

function text(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === 'string' ? value : '';
}

const FORM_FIELD: Record<string, string> = { line: 'addressLine' };

function formField(path: string): string {
  const parts = path.split('.');
  const leaf = (parts.at(-1) ?? path).match(/^\d+$/)
    ? (parts.at(-2) ?? path)
    : (parts.at(-1) ?? path);
  return FORM_FIELD[leaf] ?? leaf;
}

function fieldErrors(issues: { path: PropertyKey[]; message: string }[]): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const issue of issues) {
    const field = formField(issue.path.map(String).join('.'));
    if (field) errors[field] ??= issue.message;
  }
  return errors;
}

function apiFieldErrors(error: ApiError): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const [path, message] of Object.entries(error.fieldErrors())) {
    errors[formField(path)] ??= message;
  }
  return errors;
}

function emptyToUndefined(value: string): string | undefined {
  const trimmed = value.trim();
  return trimmed === '' ? undefined : trimmed;
}
