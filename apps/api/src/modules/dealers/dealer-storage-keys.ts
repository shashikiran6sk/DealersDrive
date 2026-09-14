import type { DealerDocType } from '@prisma/client';

export function dealerRoot(dealerSlug: string): string {
  return `dealers/${dealerSlug}`;
}

export function documentKey(dealerSlug: string, type: DealerDocType, documentId: string): string {
  return `${dealerRoot(dealerSlug)}/documents/${type}/${documentId}`;
}

export function yardPhotoKey(dealerSlug: string, mediaId: string): string {
  return `${dealerRoot(dealerSlug)}/yard/${mediaId}`;
}
