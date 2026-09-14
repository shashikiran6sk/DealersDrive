# web / features/admin/dealer-profile-editor

Parent: [web](../../../README.md)

The notes below belonged to the files named under each heading. Each heading is the
declaration the note sat above.

## `apps/web/src/features/admin/dealer-profile-editor/dealer-detail-form.tsx`

### `export function DealerDetailForm({ values, errors, onChange }: DealerDetailFormProps)`

The writable view — only rendered once _Edit_ has been pressed.

## `apps/web/src/features/admin/dealer-profile-editor/dealer-detail-list.tsx`

### `export function DealerDetailList({ values, contactPhoneDisplay }: DealerDetailListProps)`

The read view — a review screen full of live inputs invites edits meant as readings.

### `<div`

A sentence and a row of chips do not belong in the label-left,
value-right rhythm the rest of the list keeps: at 13px a tagline wraps
to two ragged right-aligned lines and a service list to three. Stacked
and left-aligned they read the way they will on the public page —
which is what the reviewer is being asked to judge.

### `servicesOf(values[field.key]).length > 0 ?`

As chips rather than the comma string the box holds: a moderator
is comparing this against the public page, and the shape makes a
dealership that typed one seventy-word "service" obvious at a
glance rather than on a character count.

### `{field.key === 'contactPhone'`

Formatted while it is being read and raw while it is being
edited — `+91 98400 12345` is what a reviewer checks against a
letterhead, `9840012345` is what the field accepts back.

## `apps/web/src/features/admin/dealer-profile-editor/dealer-profile-editor.constants.ts`

### `export const FIELDS = [`

The fields, and where each one lives in `UpdateDealerInput`.

One table rather than one JSX block per input: the form, the initial values,
the diff and the error mapping all walk it, and a field added to a form but
forgotten in the diff is the kind of bug that looks like "the console did not
save my change" and gets reported as flakiness.

`path` is the dotted path the API answers errors against, minus the `body.`
prefix — so `address.city` matches `body.address.city`.

### `{ key: 'tagline', label: 'Tagline', path: 'tagline', mono: false, wide: true }`

The two fields written for a reader rather than for a form (**R32**), so
they are the two laid out differently. They replace `About`, the last box on
the platform reading a paragraph the product stopped collecting. A reviewer
can edit them for exactly the reason `About` was editable: they are free text
a dealership typed and a buyer will read, which makes them where a phone
number gets smuggled onto a public page — what rule 7 exists to catch.

### `list: true`

A list in the schema, one comma-separated box on the screen — the same
shape the dealer's own profile form uses. `list: true` is what tells the
patch to split it back apart; without it the API would be sent a string
where `UpdateDealerInput` wants an array, and `.strict()` would answer 400.

## `apps/web/src/features/admin/dealer-profile-editor/dealer-profile-editor.tsx`

### `export function DealerProfileEditor({ dealer }: { dealer: AdminDealerDetail })`

D3 — the dealership's own answers, editable from the review screen.

The screen showed them as a definition list, which is right for the ninety
percent of reviews that end in a decision and wrong for the ten that end in a
correction: a moderator holding the GST certificate can see that the dealer
typed one digit of the GSTIN wrong, and the alternative to fixing it here is a
round trip that costs a working day per character.

**It reads before it writes**, because a review screen full of live inputs
invites edits that were meant to be readings. Cancel restores what the API last
said. **Only what changed is sent** — see `patchOf`.

The API is the authority on all of it: every field goes through the same
`dealers.update` the dealer's own `PATCH /v1/dealer` does, and a refusal comes
back naming the field.

### `const [source, setSource] = useState(dealer)`

What the API last said, as the baseline the diff is taken against. Re-derived
during render when the prop changes rather than in an effect, because
`router.refresh()` after a save delivers the new dealership as a render:
reconciling in an effect would leave one paint in which the form still holds
the values the _previous_ save was diffed from.

### `router.refresh()`

The server re-reads the dealership; `source` above picks the new values

### `router.refresh()`

up on the render that follows.

## `apps/web/src/features/admin/dealer-profile-editor/utils.ts`

### `export function patchOf(values: Values, initial: Values): Record<string, unknown>`

The dotted paths that changed, folded back into the nested shape the schema
wants. An unchanged field is absent rather than sent as itself: sending the
whole form would re-write `legalName` and `city` with the same values on every
save, and the duplicate-name check would then have to be told to ignore a
collision with the row being edited on a field nobody touched.

### `if (head === undefined) continue`

`split` on a non-empty string always yields a first segment.

### `export function errorFor(errors: Record<string, string>, path: string): string | undefined`

`body.address.city` → the `address.city` row. Also matches a bare leaf.

And an index beneath the path (**R32**): a refusal about one entry in a list
arrives as `body.specialities.3`, which none of the four exact lookups match.
Without the last clause the box a moderator has to fix is the one box with no
message on it.
