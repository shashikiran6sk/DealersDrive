# api / modules/moderation

Parent: [api](../../README.md)

The admin side of a listing (**F069**, **F070**, as revised by **R45** and
**R47**), mounted under `/v1/admin` behind `requireAdmin`. Every route adds
`requirePermission('admin:listing:moderate')` (MODERATOR, SUPER_ADMIN), so a
SUPPORT admin can read payments and audit logs but cannot see the queue, and a
dealer session never reaches the router at all.

## `apps/api/src/modules/moderation/moderation.repository.ts`

### `export function isOldestFirst(status: ListingStatus): boolean`

The review queue is worked oldest first — the car that has waited longest is
the one a moderator should open next — and sorts on `lastSubmittedAt`, so a
resubmission rejoins the queue at the back rather than jumping it with its
original submission date. Every other status is a history, read newest change
first. The cursor encodes whichever date the status sorts on.

### `function searchOf(q: string)`

The plate with separators stripped, the make or model, or the dealership's
name — the three things a moderator is told when somebody rings about a car.

## `apps/api/src/modules/moderation/moderation.mapper.ts`

### `export function toAdminListingRow(row: QueueRow, now: Date = new Date())`

The admin row is a third DTO, separate from the dealer's and the buyer's. It
carries the dealership (id, name, slug) and the town, because moderation is
cross-tenant by design; it carries no storage key, no internal flag and no
field a moderator could not act on. `resubmission` is `submissionCount > 1`,
which is what tells a moderator to look at what changed rather than start again.

There is deliberately no approve action on the queue (**R45**): a listing
cannot be approved until its photographs are uploaded and ordered, and that
happens on the review screen.

## `apps/api/src/modules/moderation/moderation.service.ts`

### `async detail(listingId)`

The whole review screen in one response (**F070**): the dealer-entered data in
the sections a moderator verifies it in, what is still incomplete (the same
`vehicleIssues()` the wizard uses), the checklist, the decision history read
from the audit log, and `actions` — which decisions the current state allows —
so the console renders the state machine rather than re-deriving it. The
dealership's contact number is shown here, formatted, because a moderator rings
dealers; it is never in a public response (rule 7).

### `async setCheck(admin, listingId, key, checked)`

The verification checklist, one row per thing checked (`listing_checks`).
Unchecking deletes the row, so there is no `false` to misread, and checking
twice is an upsert rather than a second row. Only while the listing is
PENDING_REVIEW, under the listing's row lock, with an audit row per change.

**The checklist is cleared on every move into review** (`transition()` deletes
the rows when the target is PENDING_REVIEW). A check made against the data the
dealer has since changed says nothing about the new data, and a checklist that
survived a resubmission would let a moderator approve a price they never saw.

### `async requestChanges(admin, listingId, reason)` · `async reject(admin, listingId, reason)`

The two decisions that are not approval (**F070**), both through `transition()`
under the listing's row lock, so two moderators deciding at once get one
success and one `409 LISTING_STATE_CHANGED`, and one audit row.

A request for changes sends the listing back with the moderator's words, which
the dealer sees verbatim on the vehicle and in the inventory; the vehicle is
editable again and a resubmission rejoins the back of the queue with its
checklist cleared. A rejection is final — REJECTED has no way out — but the
vehicle is **kept**, with its reason, as history. Its registration is released,
so the car can be entered again if it should be. Both need a reason of 6–500
characters (`ReasonInput`, shared with the dealer decisions).

The dealer is not emailed about either yet. The notification subscribers exist
for dealership decisions (R40); listing decisions will join them in their own
change rather than widen this one.
