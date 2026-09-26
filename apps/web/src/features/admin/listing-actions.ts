'use server';

import {
  ListingCheckKey,
  ReasonInput,
  SetPhotographyInput,
  type AdminListingDetail,
} from '@dealers-drive/contracts';
import { revalidatePath } from 'next/cache';

import { ApiError, apiSend } from '@/lib/api';

export interface ListingActionResult {
  ok: boolean;
  message?: string;
}

const UNAVAILABLE = 'The API is unavailable. Try again shortly.';

function reviewPath(listingId: string): string {
  return `/admin/listings/${listingId}`;
}

export async function setListingCheckAction(formData: FormData): Promise<void> {
  const listingId = formData.get('listingId');
  const key = ListingCheckKey.safeParse(formData.get('key'));
  if (typeof listingId !== 'string' || !key.success) return;

  try {
    await apiSend<AdminListingDetail>(
      'PUT',
      `/v1/admin/listings/${encodeURIComponent(listingId)}/checks/${key.data}`,
      { checked: formData.get('checked') === 'true' },
    );
  } catch (error) {
    if (!(error instanceof ApiError)) throw new Error(UNAVAILABLE, { cause: error });
  }
  revalidatePath(reviewPath(listingId));
}

async function decide(
  listingId: string,
  decision: 'request-changes' | 'reject',
  reason: string,
): Promise<ListingActionResult> {
  const parsed = ReasonInput.safeParse({ reason });
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? 'Give a reason.' };
  }

  try {
    await apiSend<AdminListingDetail>(
      'POST',
      `/v1/admin/listings/${encodeURIComponent(listingId)}/${decision}`,
      parsed.data,
    );
  } catch (error) {
    if (error instanceof ApiError)
      return { ok: false, message: error.userMessage(error.problem.title) };
    return { ok: false, message: UNAVAILABLE };
  }

  revalidatePath(reviewPath(listingId));
  revalidatePath('/admin/listings');
  return { ok: true };
}

export async function requestListingChangesAction(
  listingId: string,
  reason: string,
): Promise<ListingActionResult> {
  return decide(listingId, 'request-changes', reason);
}

export async function rejectListingAction(
  listingId: string,
  reason: string,
): Promise<ListingActionResult> {
  return decide(listingId, 'reject', reason);
}

export async function setPhotographyAction(formData: FormData): Promise<void> {
  const listingId = formData.get('listingId');
  const note = formData.get('note');
  const parsed = SetPhotographyInput.safeParse({
    status: formData.get('status'),
    note: typeof note === 'string' ? note.trim() || null : undefined,
  });
  if (typeof listingId !== 'string' || !parsed.success) return;

  try {
    await apiSend<AdminListingDetail>(
      'PUT',
      `/v1/admin/listings/${encodeURIComponent(listingId)}/photography`,
      parsed.data,
    );
  } catch (error) {
    if (!(error instanceof ApiError)) throw new Error(UNAVAILABLE, { cause: error });
  }
  revalidatePath(reviewPath(listingId));
}
