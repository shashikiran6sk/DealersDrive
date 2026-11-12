import type { AdminSubmittedPhotos } from '@dealers-drive/contracts';

import { DOWNLOAD_GAP_MS } from './listing-review.constants';

export function submittedPhotoHref(listingId: string, mediaId: string): string {
  return `/api/admin/listings/${encodeURIComponent(listingId)}/submitted-photos/${encodeURIComponent(mediaId)}`;
}

export function downloadAll(listingId: string, photos: AdminSubmittedPhotos): void {
  photos.items.forEach((photo, index) => {
    window.setTimeout(() => {
      const link = document.createElement('a');
      link.href = submittedPhotoHref(listingId, photo.mediaId);
      link.download = photo.downloadName;
      link.click();
    }, index * DOWNLOAD_GAP_MS);
  });
}
