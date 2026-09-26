'use server';

import { ListingCheckKey, type AdminListingDetail } from '@dealers-drive/contracts';
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
