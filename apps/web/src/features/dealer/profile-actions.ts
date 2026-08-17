'use server';

import { UpdateDealerInput, type DealerProfile } from '@dealers-drive/contracts';
import { revalidatePath } from 'next/cache';

import { ApiError, apiSend } from '@/lib/api';

export interface ProfileFormState {
  status: 'idle' | 'saved' | 'error';
  fieldErrors: Record<string, string>;
  message?: string;
}

/**
 * C2 `PATCH /v1/dealer`.
 *
 * Which dealer is being edited is never in this payload — the API takes it from
 * the session (Rule 1). Nor are `status`, `slug` or `creditBalance` accepted by
 * `UpdateDealerInput`: a dealer cannot verify or fund themselves by editing
 * their own profile.
 */
export async function saveDealerProfileAction(
  _previous: ProfileFormState,
  formData: FormData,
): Promise<ProfileFormState> {
  const text = (key: string): string | undefined => {
    const value = formData.get(key);
    if (typeof value !== 'string') return undefined;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  };

  const specialities = (text('specialities') ?? '')
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);

  const year = text('establishedYear');

  const parsed = UpdateDealerInput.safeParse({
    ...(text('brandName') ? { brandName: text('brandName') } : {}),
    ...(text('legalName') ? { legalName: text('legalName') } : {}),
    ...(text('tagline') ? { tagline: text('tagline') } : {}),
    ...(text('about') ? { about: text('about') } : {}),
    ...(year ? { establishedYear: Number(year) } : {}),
    ...(specialities.length > 0 ? { specialities } : {}),
    contact: {
      ...(text('contactFullName') ? { fullName: text('contactFullName') } : {}),
      ...(text('contactRoleTitle') ? { roleTitle: text('contactRoleTitle') } : {}),
      ...(text('contactEmail') ? { email: text('contactEmail') } : {}),
      ...(text('contactLandline') ? { landline: text('contactLandline') } : {}),
    },
    address: {
      ...(text('addressLine') ? { line: text('addressLine') } : {}),
      ...(text('addressPincode') ? { pincode: text('addressPincode') } : {}),
      ...(text('addressState') ? { state: text('addressState') } : {}),
    },
  });

  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      // "contact.email" -> "contactEmail", matching the input names above.
      const [head, tail] = issue.path;
      const field =
        typeof head === 'string' && typeof tail === 'string'
          ? `${head}${tail.charAt(0).toUpperCase()}${tail.slice(1)}`
          : String(head);
      fieldErrors[field] ??= issue.message;
    }
    return { status: 'error', fieldErrors };
  }

  try {
    await apiSend<DealerProfile>('PATCH', '/v1/dealer', parsed.data);
  } catch (error) {
    if (error instanceof ApiError) {
      const fieldErrors = error.fieldErrors();
      return {
        status: 'error',
        fieldErrors,
        ...(Object.keys(fieldErrors).length > 0
          ? {}
          : { message: error.problem.detail ?? error.problem.title }),
      };
    }
    return { status: 'error', fieldErrors: {}, message: 'We could not save your changes.' };
  }

  // The brand name is in the console top bar and on every public card.
  revalidatePath('/dealer', 'layout');

  return { status: 'saved', fieldErrors: {} };
}
