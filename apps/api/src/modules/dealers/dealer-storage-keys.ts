import type { DealerDocType } from '@prisma/client';

/**
 * Where a dealership's private files live, in one place.
 *
 * The key is the only thing that knows where an object is, and it is derived
 * rather than stored for KYC documents — the last segment is the *row's* id, so
 * replacing a document, deleting one, or purging a whole application all have
 * to rebuild the same string from the same three parts. Three modules were
 * building it: `dealers.service.ts` on the write paths, and `admin.service.ts`
 * both when signing a read for a reviewer and when emptying the bucket on a
 * rejection. A template literal copied into three files is a retention bug
 * waiting for one of them to be changed.
 */
export function documentKey(dealerId: string, type: DealerDocType, documentId: string): string {
  return `kyc/${dealerId}/${type}/${documentId}`;
}

/**
 * Where a yard photograph lives. Deliberately **not** under `kyc/`: it is
 * destined to be the public face of the dealership, not a private scan, and the
 * prefixes are what keep the two apart.
 */
export function yardPhotoKey(dealerId: string, mediaId: string): string {
  return `dealers/${dealerId}/yard/${mediaId}`;
}
