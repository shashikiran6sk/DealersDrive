# web / features/auth/document-uploader

Parent: [web](../../../README.md)

The notes below belonged to the files named under each heading. Each heading is the
declaration the note sat above.

## `apps/web/src/features/auth/document-uploader/document-uploader.constants.ts`

### `export const TAG: Record<DealerDocumentDto['status'], string> =`

A tag is a state, not a sentence. The API's `statusLabel` is written for the
row's sub-line ("Required — PDF or JPG, max 5 MB"); repeating it inside the tag
says the same thing twice and pushes the row over its width.

## `apps/web/src/features/auth/document-uploader/document-uploader.tsx`

### `export function DocumentUploader({ document }: { document: DealerDocumentDto })`

DESIGN-SPEC §3.10 step 3 — one KYC document row.

presign → PUT straight to storage → commit, the same three-step contract the
vehicle photos use (ARCHITECTURE §12.1). KYC documents are private: there is
no public delivery route for them at all — an admin reads one through a
short-lived signed URL, and every issue of one is audit-logged (§26.6).

**Replace and Remove are two verbs, not one.** Replace is presign → PUT →
commit and the API deletes the displaced object as part of it. Remove is the
dealer deciding a document should not be there at all — the wrong scan, the
wrong dealership's PAN card — and the row goes back to `REQUIRED` with the
bytes gone.

### `const uploaded = document.status !== 'REQUIRED'`

Anything but `REQUIRED` means bytes exist, and bytes can be taken back.

### `{uploaded ?`

Only when there is something to delete. A `Delete` next to an empty row is
a control that cannot do anything, and a disabled one is worse — it
implies the row is in a state the dealer could get out of.
