'use server';

import { SavedState, SavedVehicleSlugs, VehicleSlugParam } from '@dealers-drive/contracts';
import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';

import { ApiError, apiGetParsed, apiSend, SESSION_COOKIE } from '@/lib/api';

import { SAVED_ACTION_TEXT, SAVED_PATH } from './saved.constants';
import type { SavedSlugsState, SetSavedResult } from './saved.types';

async function signedIn(): Promise<boolean> {
  return Boolean((await cookies()).get(SESSION_COOKIE)?.value);
}

export async function savedSlugsAction(): Promise<SavedSlugsState> {
  if (!(await signedIn())) return { status: 'anonymous' };
  try {
    const { slugs } = await apiGetParsed(SavedVehicleSlugs, '/v1/saved-vehicles/slugs', {
      revalidate: false,
    });
    return { status: 'customer', slugs };
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) return { status: 'anonymous' };
    return { status: 'unknown' };
  }
}

export async function setSavedAction(slug: string, saved: boolean): Promise<SetSavedResult> {
  const param = VehicleSlugParam.safeParse({ slug });
  if (!param.success) return { status: 'refused', message: SAVED_ACTION_TEXT.invalid };
  if (!(await signedIn())) return { status: 'signed-out' };

  try {
    const result = SavedState.parse(
      await apiSend<unknown>(
        saved ? 'PUT' : 'DELETE',
        `/v1/saved-vehicles/${encodeURIComponent(param.data.slug)}`,
      ),
    );
    revalidatePath(SAVED_PATH);
    return { status: 'ok', saved: result.saved };
  } catch (error) {
    if (error instanceof ApiError) {
      if (error.status === 401) return { status: 'signed-out' };
      return { status: 'refused', message: error.userMessage(SAVED_ACTION_TEXT.failed) };
    }
    return { status: 'refused', message: SAVED_ACTION_TEXT.unavailable };
  }
}
