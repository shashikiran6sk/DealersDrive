'use server';

import { IdParam, SubmittedPhotosDownload, Uuid } from '@dealers-drive/contracts';

import { ApiError, apiSend } from '@/lib/api';

import { SUBMITTED_PHOTOS_ACTION_TEXT } from './submitted-photos-actions.constants';

export type DownloadLinkResult =
  { ok: true; url: string; fileName: string } | { ok: false; message: string };

export async function submittedPhotosDownloadAction(
  listingId: string,
  mediaId?: string,
): Promise<DownloadLinkResult> {
  const listing = IdParam.safeParse({ id: listingId });
  const media = mediaId === undefined ? null : Uuid.safeParse(mediaId);
  if (!listing.success || (media && !media.success)) {
    return { ok: false, message: SUBMITTED_PHOTOS_ACTION_TEXT.failed };
  }
  try {
    const raw = await apiSend<unknown>(
      'POST',
      `/v1/admin/listings/${encodeURIComponent(listing.data.id)}/submitted-photos/download`,
      media?.success ? { mediaId: media.data } : {},
    );
    const parsed = SubmittedPhotosDownload.safeParse(raw);
    return parsed.success
      ? { ok: true, url: parsed.data.url, fileName: parsed.data.fileName }
      : { ok: false, message: SUBMITTED_PHOTOS_ACTION_TEXT.failed };
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof ApiError
          ? error.userMessage(SUBMITTED_PHOTOS_ACTION_TEXT.failed)
          : SUBMITTED_PHOTOS_ACTION_TEXT.failed,
    };
  }
}
