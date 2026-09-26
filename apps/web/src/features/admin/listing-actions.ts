'use server';

import {
  ListingCheckKey,
  ListingImageParam,
  ReasonInput,
  ReorderImagesInput,
  SetPhotographyInput,
  VehicleImagePresignInput,
  type AdminListingDetail,
  type AdminVehicleImages,
  type PresignResponse,
} from '@dealers-drive/contracts';
import { revalidatePath } from 'next/cache';

import { ApiError, apiSend } from '@/lib/api';

export interface ListingActionResult {
  ok: boolean;
  message?: string;
}

export type ImagePresignResult =
  { ok: true; upload: PresignResponse } | { ok: false; message: string };

const UNAVAILABLE = 'The API is unavailable. Try again shortly.';

const IMAGE_REFUSED = 'Only JPEG, PNG or WebP images up to 10 MB can be uploaded.';

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

export async function approveListingAction(listingId: string): Promise<ListingActionResult> {
  try {
    await apiSend<AdminListingDetail>(
      'POST',
      `/v1/admin/listings/${encodeURIComponent(listingId)}/approve`,
    );
  } catch (error) {
    return failure(error);
  }
  revalidatePath(reviewPath(listingId));
  revalidatePath('/admin/listings');
  return { ok: true };
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

function failure(error: unknown): { ok: false; message: string } {
  if (error instanceof ApiError)
    return { ok: false, message: error.userMessage(error.problem.title) };
  return { ok: false, message: UNAVAILABLE };
}

export async function presignListingImageAction(
  listingId: string,
  file: { fileName: string; mimeType: string; bytes: number },
): Promise<ImagePresignResult> {
  const parsed = VehicleImagePresignInput.safeParse(file);
  if (!parsed.success) return { ok: false, message: IMAGE_REFUSED };

  try {
    const upload = await apiSend<PresignResponse>(
      'POST',
      `/v1/admin/listings/${encodeURIComponent(listingId)}/images/presign`,
      parsed.data,
    );
    return { ok: true, upload };
  } catch (error) {
    return failure(error);
  }
}

export async function commitListingImageAction(
  listingId: string,
  mediaId: string,
): Promise<ListingActionResult> {
  const params = ListingImageParam.safeParse({ id: listingId, mediaId });
  if (!params.success) return { ok: false, message: IMAGE_REFUSED };

  try {
    await apiSend<AdminVehicleImages>(
      'POST',
      `/v1/admin/listings/${params.data.id}/images/${params.data.mediaId}/commit`,
    );
  } catch (error) {
    return failure(error);
  }
  revalidatePath(reviewPath(params.data.id));
  revalidatePath('/admin/listings');
  return { ok: true };
}

export async function removeListingImageAction(formData: FormData): Promise<void> {
  const params = ListingImageParam.safeParse({
    id: formData.get('listingId'),
    mediaId: formData.get('mediaId'),
  });
  if (!params.success) return;

  try {
    await apiSend<AdminVehicleImages>(
      'DELETE',
      `/v1/admin/listings/${params.data.id}/images/${params.data.mediaId}`,
    );
  } catch (error) {
    if (!(error instanceof ApiError)) throw new Error(UNAVAILABLE, { cause: error });
  }
  revalidatePath(reviewPath(params.data.id));
  revalidatePath('/admin/listings');
}

export async function reorderListingImagesAction(formData: FormData): Promise<void> {
  const listingId = formData.get('listingId');
  const order = formData.get('order');
  const parsed = ReorderImagesInput.safeParse({
    mediaIds: typeof order === 'string' ? order.split(',') : [],
  });
  const params = ListingImageParam.shape.id.safeParse(listingId);
  if (!params.success || !parsed.success) return;

  try {
    await apiSend<AdminVehicleImages>(
      'PUT',
      `/v1/admin/listings/${params.data}/images/order`,
      parsed.data,
    );
  } catch (error) {
    if (!(error instanceof ApiError)) throw new Error(UNAVAILABLE, { cause: error });
  }
  revalidatePath(reviewPath(params.data));
}

export async function setPrimaryImageAction(formData: FormData): Promise<void> {
  const params = ListingImageParam.safeParse({
    id: formData.get('listingId'),
    mediaId: formData.get('mediaId'),
  });
  if (!params.success) return;

  try {
    await apiSend<AdminVehicleImages>(
      'PUT',
      `/v1/admin/listings/${params.data.id}/images/${params.data.mediaId}/primary`,
    );
  } catch (error) {
    if (!(error instanceof ApiError)) throw new Error(UNAVAILABLE, { cause: error });
  }
  revalidatePath(reviewPath(params.data.id));
}
