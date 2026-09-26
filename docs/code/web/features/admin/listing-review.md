# web / features/admin/listing-review

Parent: [web](../../README.md)

## `apps/web/src/features/admin/listing-review/listing-review.tsx`

### `export function ListingReview({ detail }: { detail: AdminListingDetail })`

DESIGN-SPEC §3.17's _Review listing_, reshaped by **R45**: the dealer's data on
the left in the sections a moderator checks it in, and on the right the
decisions, the photography panel, the verification checklist and the history.
Everything that decides what is offered comes from `detail.actions`, which the
API computes from the listing's state — the screen renders the state machine,
it does not re-derive it.

## `apps/web/src/features/admin/listing-review/check-row.tsx`

### `export function CheckRow(...)`

One server-action form per check, so ticking works without JavaScript and each
press is exactly one `PUT`. The button carries `aria-pressed` and a label that
names the check, because "Mark checked" seven times over is not a usable list
for a screen reader.

## `apps/web/src/features/admin/listing-review/decision-dialog.tsx`

### `export function DecisionDialog(...)`

DESIGN-SPEC §2.14's reject dialog, used for both _Request changes_ and _Reject_:
a textarea that takes focus, a confirm that stays disabled until the reason is
six characters (the same floor `ReasonInput` enforces on the server), a pending
state that disables both buttons, and the API's refusal shown inside the dialog
rather than closing it — a moderator who lost a race with a colleague needs to
read why before the screen changes under them.

## `apps/web/src/features/admin/listing-review/photography-panel.tsx`

### `export function PhotographyPanel({ detail }: { detail: AdminListingDetail })`

A plain `<form action={setPhotographyAction}>` — a select and a note, no client
state — because the save is a single PUT and the page re-renders from the API
afterwards. `canUpdate` comes from the server, so the form disappears exactly
when the API would answer `409 PHOTOGRAPHY_CLOSED`. The note is labelled as
internal because it is: the dealer never sees it.

## `apps/web/src/features/admin/listing-review/decision-panel.tsx`

### `export function DecisionPanel({ detail }: { detail: AdminListingDetail })`

The Approve button is always shown while the listing is in review, and it is
disabled with the API's `blockers` listed under it until nothing blocks it —
a moderator sees what is missing, not merely that approval is unavailable.
The console computes none of it: `actions.canApprove` and `blockers` come
from the same API function that guards the route.

## `apps/web/src/features/admin/listing-review/approve-dialog.tsx`

### `export function ApproveDialog({ submit }: ApproveDialogProps)`

A confirmation, because approval publishes and freezes the gallery and the
checklist. No reason is asked for: the decision is recorded in the audit log
with who and when, and there is nothing to tell the dealer beyond "live". A
refusal (someone removed an image in another tab) is shown in the dialog.
