# web / features/auth/document-uploader

Parent: [web](../../../README.md)

The notes below belonged to the files named under each heading. Each heading is the
declaration the note sat above.

## `apps/web/src/features/auth/document-uploader/document-uploader.constants.ts`

### `export const TAG: Record<DealerDocumentDto['status'], string> =`

A tag is a state, not a sentence. The API's `statusLabel` is written for the
row's sub-line ("Not uploaded yet — PDF, JPEG or PNG, up to 5 MB"); repeating
it inside the tag says the same thing twice and pushes the row over its width.

An empty slot reads **Needed to submit**, not "Required": since #299 a draft
is saved without documents, and "Required" on a card the dealer may leave
empty today would read as a blocker it is not.

### `export function documentPaths(base: string)`

Commit and delete are addressed by **category**. A dealership holds one
document per category, so the category is the slot's key; the type is chosen
at presign and checked against the category there.

## `apps/web/src/features/auth/document-uploader/document-uploader.tsx`

### `export function DocumentUploader({`

DESIGN-SPEC §3.10 step 3 — one document category slot (#299).

**One card is one category.** The API holds at most one document per
category (Personal Identity Proof, Business Identity Proof) of whichever
listed type the dealer chose, and the requirement to submit is "one in each".
A card per type would show five personal slots and eight business ones and
invite a dealer to fill several; a card per category is the requirement drawn
as it is judged.

presign → PUT straight to storage → commit, the same three-step contract the
other uploads use. KYC documents are private: there is no public delivery
route for them at all — an admin reads one through a short-lived signed URL,
and every issue of one is audit-logged (§26.6).

**Replace and Remove are two verbs, not one.** Replace is presign → PUT →
commit and the API deletes the displaced object as part of it. Remove is the
dealer deciding a document should not be there at all, and the slot goes back
to empty with the bytes gone.

`basePath` is a plain string so the Sales dealer page — a server component —
can hand its own BFF base to this client component; a function prop cannot
be serialised across that boundary.

### `const [type, setType] = useState(() => initialType(category, document, gstinOnFile))`

Nothing is preselected for an empty personal slot. The first type in that
list is Aadhaar, which is voluntary; defaulting to it would quietly steer a
dealer towards the one document the product goes out of its way not to ask
for. With a GSTIN on file the business slot starts on the GST certificate,
because that is the only business proof that will satisfy the requirement.

### `function readyProblem(): string | null`

The checks `DocumentPresignInput` would refuse anyway — a type, and a
description for another certificate — are made before the file picker opens,
so a dealer is told what is missing before choosing a file rather than after
it has been rejected.

### `const uploaded = status !== 'REQUIRED'`

Anything but `REQUIRED` means bytes exist, and bytes can be taken back.

### `{uploaded ? (`

Only when there is something to delete. A `Delete` next to an empty slot is
a control that cannot do anything, and a disabled one is worse — it implies
the slot is in a state the dealer could get out of.

## `apps/web/src/features/auth/document-uploader/document-type-field.tsx`

### `export function DocumentTypeField({`

The picker offers only `DOC_CATEGORY_TYPES[category]`, labelled with
`DOC_TYPE_LABELS` and hinted with `DOC_TYPE_HINTS` from contracts — the same
lists the API validates and the admin review reads, so a label cannot drift
between the screen that asks and the screen that judges. Constraining the
select to the category means a type from the wrong category is not a refusal
the dealer meets after uploading; it is not an option at all.

The description field exists only for `OTHER_BUSINESS_CERTIFICATE`, because
it is the only type whose name does not say what the document is. The
contract refuses a description on any other type, so showing the field
elsewhere would be inviting a 400.

### `const gstMismatch = category === 'BUSINESS_IDENTITY' && gstinOnFile && type !== 'GST_CERTIFICATE'`

A warning, not a block. The API still accepts another business proof and
reports the GST certificate as an outstanding gap; saying so beside the
picker is cheaper than the dealer finding out on the Review step.

## `apps/web/src/features/auth/document-uploader/utils.ts`

### `export function documentForCategory(`

The slot is found by `category` on the row, never by type. A placeholder
`REQUIRED` row is treated as empty, because its type was the server's
default rather than anything the dealer chose.
