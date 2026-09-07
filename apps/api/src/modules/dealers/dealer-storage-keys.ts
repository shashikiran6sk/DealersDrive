import type { DealerDocType } from '@prisma/client';

/**
 * Where a dealership's files live, in one place.
 *
 * ## One folder per dealership, named after the dealership
 *
 * Everything a dealership owns sits under `dealers/{slug}/` — the KYC scans
 * under `documents/`, the yard photograph under `yard/`. It used to be two
 * unrelated trees keyed on the UUID: `kyc/{dealerId}/…` and
 * `dealers/{dealerId}/yard/…`. That split cost something real every time
 * somebody opened the bucket, because the two halves of one dealership's
 * upload sat in two places and neither was labelled with a name a person could
 * recognise. `dealers/sri-lakshmi-motors-katpadi-vellore-tamil-nadu/` is.
 *
 * The prefixes still separate the private from the eventually-public — nothing
 * serves `documents/`, and `yard/` is what fronts the portfolio — but they are
 * now two prefixes inside one folder rather than two roots.
 *
 * ## The key is derived, and the slug is what it is derived from
 *
 * For a KYC document the key is not stored anywhere: the last segment is the
 * *row's* id, so replacing a document, deleting one, or purging a whole
 * application all rebuild the same string from the same parts. Three modules
 * were building it by hand before this file existed, and a template literal
 * copied into three files is a retention bug waiting for one of them to change.
 *
 * The consequence is that **a dealership's slug may not change without moving
 * its objects in the same pass.** No write path changes one (see `dealerSlug`
 * in the contracts package); `apps/api/scripts/relocate-dealer-storage.ts` is
 * the one thing that does, and it moves the bytes.
 */
export function dealerRoot(dealerSlug: string): string {
  return `dealers/${dealerSlug}`;
}

/** A private KYC scan. There is no route that serves this prefix. */
export function documentKey(dealerSlug: string, type: DealerDocType, documentId: string): string {
  return `${dealerRoot(dealerSlug)}/documents/${type}/${documentId}`;
}

/** The photograph destined to be the public face of the dealership. */
export function yardPhotoKey(dealerSlug: string, mediaId: string): string {
  return `${dealerRoot(dealerSlug)}/yard/${mediaId}`;
}
