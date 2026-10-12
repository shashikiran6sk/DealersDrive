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

export function portfolioKey(dealerSlug: string, mediaId: string): string {
  return `${dealerRoot(dealerSlug)}/portfolio/${mediaId}`;
}

export function yardVisitPhotoKey(dealerSlug: string, visitId: string, mediaId: string): string {
  return `${dealerRoot(dealerSlug)}/yard-visits/${visitId}/${mediaId}`;
}
