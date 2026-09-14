# web / features/admin/document-review

Parent: [web](../../../README.md)

The notes below belonged to the files named under each heading. Each heading is the
declaration the note sat above.

## `apps/web/src/features/admin/document-review/document-review.constants.ts`

### `export const MIN_REJECTION_REASON = 6`

Below this a reason is not a reason, and the dealer has nothing to act on.

### `rejectFile: 'Reject file'`

"Reject file", not "Reject" — the word alone reads as a verdict on the dealership.

## `apps/web/src/features/admin/document-review/document-review.tsx`

### `export function DocumentReview({ documents, dealerSlug }: DocumentReviewProps)`

D5 — the KYC decision, on the row it is about.

The endpoints have existed since F044 and nothing called them, which had a
consequence beyond the missing buttons: approving a dealership requires all
three documents `VERIFIED`, so with no way to verify one the approve control
could never appear.

A rejection reason is mandatory and is shown to the dealer verbatim — it is
what they re-upload against, so "rejected" on its own costs a round trip.

**Rejecting a document is not rejecting the dealer.** It rejects one _file_:
the scan is deleted, the row is emptied so the dealer sees the slot they saw
before they uploaded, and the application is handed back as a draft so they
can reach the upload box at all. The other two documents are untouched. The
control that rejects a _dealership_ is `DealerAdminActions`, it is behind a
confirmation, and it deletes everything.

## `apps/web/src/features/admin/document-review/document-review.types.ts`

### `dealerSlug: string`

The dealership these documents belong to, for cache invalidation only.
Rejecting one can hand a PENDING_APPROVAL application back to DRAFT, and a
dealership that is not ACTIVE is not public — so a decision here can remove
a portfolio from the marketplace, and the cached copy has to go with it.

## `apps/web/src/features/admin/document-review/document-row.tsx`

### `const decidable = document.status === 'UPLOADED'`

Only a document that has actually been uploaded can be decided on: a
REQUIRED row has no file behind it, and a decided one is re-decided by the
dealer re-uploading rather than by a moderator changing their mind in place.
A REJECTED row is genuinely empty — the file was deleted when it was
rejected — which is why it reads the same as REQUIRED.

### `{document.viewUrl ?`

`viewUrl` is short-lived and audit-logged — the only way a KYC
document is ever read (D5).

### `<p className="w-full text-[12px] ink-muted">`

The consequence, stated before the button is pressed.
