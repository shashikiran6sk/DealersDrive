import type { PresignResponse } from '@dealers-drive/contracts';

import {
  commitListingImageAction,
  presignListingImageAction,
} from '@/features/admin/listing-actions';
import { failureMessage, fileRejection, putToStorage } from '@/lib/upload';

import { IMAGE_RULE, LISTING_IMAGES_TEXT } from './listing-images.constants';

export function moved(order: string[], index: number, delta: -1 | 1): string[] | null {
  const target = index + delta;
  if (target < 0 || target >= order.length) return null;
  const next = [...order];
  const [item] = next.splice(index, 1);
  if (item === undefined) return null;
  next.splice(target, 0, item);
  return next;
}

export async function uploadOne(listingId: string, file: File): Promise<string | null> {
  const rejection = fileRejection(file, IMAGE_RULE);
  if (rejection) return LISTING_IMAGES_TEXT.fileRefused(file.name, rejection);

  const presigned = await presignListingImageAction(listingId, {
    fileName: file.name,
    mimeType: file.type,
    bytes: file.size,
  });
  if (!presigned.ok) return LISTING_IMAGES_TEXT.fileFailed(file.name, presigned.message);

  const upload: PresignResponse = presigned.upload;
  if (!upload.mediaId)
    return LISTING_IMAGES_TEXT.fileFailed(file.name, LISTING_IMAGES_TEXT.storageRefused);

  try {
    await putToStorage(upload, file);
  } catch (caught) {
    return LISTING_IMAGES_TEXT.fileFailed(
      file.name,
      failureMessage(caught, LISTING_IMAGES_TEXT.storageRefused),
    );
  }

  const committed = await commitListingImageAction(listingId, upload.mediaId);
  if (!committed.ok) {
    return LISTING_IMAGES_TEXT.fileFailed(file.name, committed.message ?? '');
  }
  return null;
}
