'use server';

import {
  ProgressiveRegistrationInput,
  ProgressiveAssistedRegistrationInput,
  ProgressivePlanInput,
  UpdateDealerInput,
  UpdateAssistedDealerInput,
  type AuthSession,
  type SalesDealerDetail,
} from '@dealers-drive/contracts';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import type { ActionState } from '@/features/auth/actions';
import { apiSend, ApiError } from '@/lib/api';

function values(form: FormData) {
  return Object.fromEntries(
    Array.from(form.entries()).filter(
      (entry): entry is [string, string] => typeof entry[1] === 'string',
    ),
  );
}
function failure(error: unknown): ActionState {
  return error instanceof ApiError
    ? { message: error.userMessage('That could not be saved.'), errors: error.fieldErrors() }
    : { message: 'The API is unavailable. Try again shortly.' };
}
function invalid(
  issues: readonly { path: readonly PropertyKey[]; message: string }[],
): ActionState {
  return {
    errors: Object.fromEntries(
      issues.map((issue) => [String(issue.path.at(-1) ?? 'form'), issue.message]),
    ),
  };
}
export async function registerProgressiveAction(
  _previous: ActionState,
  form: FormData,
): Promise<ActionState> {
  const raw = values(form);
  const parsed = ProgressiveRegistrationInput.safeParse({
    fullName: raw.fullName,
    phone: raw.phone,
    legalName: raw.legalName,
    city: raw.city,
    district: raw.district,
    state: raw.state,
    declaration: raw.declaration === 'on',
  });
  if (!parsed.success) return invalid(parsed.error.issues);
  try {
    await apiSend<AuthSession>('POST', '/v1/auth/dealer/register', parsed.data);
  } catch (error) {
    return failure(error);
  }
  redirect('/dealer/register');
}
export async function registerProgressiveAssistedAction(
  _previous: ActionState,
  form: FormData,
): Promise<ActionState> {
  const raw = values(form);
  const parsed = ProgressiveAssistedRegistrationInput.safeParse({
    contactName: raw.contactName,
    email: raw.email,
    phoneTicket: raw.phoneTicket,
    legalName: raw.legalName,
    city: raw.city,
    district: raw.district,
    state: raw.state,
    declaration: raw.declaration === 'on',
  });
  if (!parsed.success) return invalid(parsed.error.issues);
  let dealer: SalesDealerDetail;
  try {
    dealer = await apiSend<SalesDealerDetail>('POST', '/v1/sales/dealers/register', parsed.data);
  } catch (error) {
    return failure(error);
  }
  redirect(`/sales/dealers/${dealer.id}`);
}
export async function saveProgressiveAction(
  _previous: ActionState,
  form: FormData,
): Promise<ActionState> {
  const raw = values(form);
  const parsed = UpdateDealerInput.safeParse({
    ...(raw.addressLine?.trim()
      ? {
          address: {
            line: raw.addressLine,
            ...(raw.pincode?.trim() ? { pincode: raw.pincode } : {}),
          },
        }
      : raw.pincode?.trim()
        ? { address: { pincode: raw.pincode } }
        : {}),
    ...(raw.pan?.trim() ? { pan: raw.pan.trim().toUpperCase() } : {}),
    ...(raw.gstin?.trim() ? { gstin: raw.gstin.trim().toUpperCase() } : {}),
  });
  if (!parsed.success) return invalid(parsed.error.issues);
  try {
    await apiSend('PATCH', '/v1/dealer/onboarding', parsed.data);
  } catch (error) {
    return failure(error);
  }
  revalidatePath('/dealer/register');
  return { saved: true };
}
export async function submitProgressiveAction(): Promise<ActionState> {
  try {
    await apiSend('POST', '/v1/dealer/submit');
  } catch (error) {
    return failure(error);
  }
  revalidatePath('/dealer/register');
  return { saved: true };
}
export async function reviewProgressiveAction(
  _previous: ActionState,
  form: FormData,
): Promise<ActionState> {
  const raw = values(form);
  const parsed = ProgressivePlanInput.safeParse({
    expectedVersion: Number(raw.version),
    plan: {
      classification: raw.classification,
      classificationReference: raw.classificationReference,
      requiredDocuments: form.getAll('requiredDocuments'),
      gstRequirement: raw.gstRequirement,
      gstReference: raw.gstReference,
      representativeIdentityReference: raw.representativeIdentityReference,
      representativeAuthorityReference: raw.representativeAuthorityReference,
      businessExistenceReference: raw.businessExistenceReference,
      regulatoryOutcome: raw.regulatoryOutcome,
      regulatoryReference: raw.regulatoryReference,
    },
  });
  if (!parsed.success) return invalid(parsed.error.issues);
  try {
    await apiSend(
      'PUT',
      `/v1/admin/dealers/${encodeURIComponent(raw.dealerId ?? '')}/progressive-plan`,
      parsed.data,
    );
  } catch (error) {
    return failure(error);
  }
  revalidatePath(`/admin/dealers/${raw.dealerId}`);
  return { saved: true };
}

export async function saveProgressiveAssistedAction(
  dealerId: string,
  _previous: ActionState,
  form: FormData,
): Promise<ActionState> {
  const raw = values(form);
  const parsed = UpdateAssistedDealerInput.safeParse(
    Object.fromEntries(
      ['addressLine', 'pincode', 'pan', 'gstin']
        .filter((key) => raw[key]?.trim())
        .map((key) => [key, raw[key]]),
    ),
  );
  if (!parsed.success) return invalid(parsed.error.issues);
  try {
    await apiSend('PATCH', `/v1/sales/dealers/${encodeURIComponent(dealerId)}`, parsed.data);
  } catch (error) {
    return failure(error);
  }
  revalidatePath(`/sales/dealers/${dealerId}`);
  return { saved: true };
}
