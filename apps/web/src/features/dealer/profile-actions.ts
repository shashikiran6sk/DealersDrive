'use server';

import { DealerSelfUpdateInput, type DealerProfile } from '@dealers-drive/contracts';
import { revalidatePath } from 'next/cache';

import { ApiError, apiSend } from '@/lib/api';
import { revalidatePublicDealer } from '@/lib/cache-tags';
import { servicesOf } from '@/lib/services';

export interface ProfileFormState {
  status: 'idle' | 'saved' | 'error';
  fieldErrors: Record<string, string>;
  message?: string;
}

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

  const specialities = servicesOf(text('specialities') ?? '');

  const year = text('establishedYear');

  const parsed = DealerSelfUpdateInput.safeParse({
    ...(year ? { establishedYear: Number(year) } : {}),
    ...(text('tagline') ? { tagline: text('tagline') } : {}),
    ...(specialities.length > 0 ? { specialities } : {}),
  });

  if (!parsed.success) {
    return { status: 'error', fieldErrors: flatten(parsed.error.issues) };
  }

  let saved: DealerProfile;
  try {
    saved = await apiSend<DealerProfile>('PATCH', '/v1/dealer', parsed.data);
  } catch (error) {
    if (error instanceof ApiError) {
      const fieldErrors = mapApiFields(error.fieldErrors());
      return {
        status: 'error',
        fieldErrors,
        ...(Object.keys(fieldErrors).length > 0
          ? {}
          : { message: error.userMessage(error.problem.title) }),
      };
    }
    return { status: 'error', fieldErrors: {}, message: 'We could not save your changes.' };
  }

  revalidatePath('/dealer', 'layout');

  revalidatePublicDealer(saved.slug);

  return { status: 'saved', fieldErrors: {} };
}

export async function withdrawProfileChangeAction(): Promise<string | null> {
  let saved: DealerProfile;
  try {
    saved = await apiSend<DealerProfile>('DELETE', '/v1/dealer/profile-change', undefined);
  } catch (error) {
    if (error instanceof ApiError) {
      if (error.status === 404) {
        revalidatePath('/dealer', 'layout');
        return null;
      }
      return error.userMessage(error.problem.title);
    }
    return 'We could not cancel that change.';
  }

  revalidatePath('/dealer', 'layout');
  revalidatePublicDealer(saved.slug);
  return null;
}

function flatten(
  issues: readonly { path: PropertyKey[]; message: string }[],
): Record<string, string> {
  const fieldErrors: Record<string, string> = {};
  for (const issue of issues) {
    const [head, tail] = issue.path;
    const field =
      typeof head === 'string' && typeof tail === 'string' ? camel(head, tail) : String(head);
    fieldErrors[field] ??= issue.message;
  }
  return fieldErrors;
}

function mapApiFields(errors: Record<string, string>): Record<string, string> {
  const mapped: Record<string, string> = {};
  for (const [path, message] of Object.entries(errors)) {
    const [head, tail] = path.split('.');
    const field = head !== undefined && tail !== undefined ? camel(head, tail) : path;
    mapped[field] ??= message;
  }
  return mapped;
}

function camel(head: string, tail: string): string {
  return `${head}${tail.charAt(0).toUpperCase()}${tail.slice(1)}`;
}
