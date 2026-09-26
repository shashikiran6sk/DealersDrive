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

### `async setPhotography(admin, listingId, input)`

Where Dealers-Drive's own photography of the car has got to (**R45**):
`NOT_STARTED → SCHEDULED → PHOTOGRAPHED → PROCESSING → READY`. It is a note the
operations team keeps for itself, not a workflow the code enforces — any status
may follow any other, because a reshoot sends a car back to `SCHEDULED` and a
car photographed on the first visit skips straight to `PHOTOGRAPHED`.
`PROCESSING` means "in StudioCar", entered by a person; nothing here calls
StudioCar, and there is no batch id to fabricate.

It lives in its own table, `vehicle_photography`, one row per vehicle, created
on first write — a vehicle with no row reads as `NOT_STARTED`. It is keyed on
the vehicle rather than the listing because the photographs belong to the car:
a listing resubmitted after changes still has the same car, already shot.

It may be set only while the listing is in review (`PENDING_REVIEW` or
`CHANGES_REQUESTED`) — `409 PHOTOGRAPHY_CLOSED` otherwise — so a live or
decided listing's history is not rewritten. The row is locked by the listing
lock like every other moderation write, and each change writes a
`vehicle.photography_set` audit row against the **Vehicle**, carrying the old
and new status. The note is internal: it is in the admin detail and nowhere
else, and no dealer or public DTO carries this table at all.

The status is a readiness signal for people. Approval (F070) is guarded by the
images actually attached, never by this label.

### `async approve(admin, listingId)`

The one decision that publishes (**F070**, guarded by **R45**/**R47**).
Under the listing's row lock it first asks the state machine whether an
admin may approve from here (`409 LISTING_NOT_APPROVABLE` otherwise, before
any other work), then reads the approval state fresh inside the same
transaction and refuses with `409 LISTING_NOT_READY` and a `blockers` array
if anything is unmet. Only then does `transition()` move the listing to
ACTIVE and stamp `publishedAt`, and a listing approved for the first time is
given its public slug in the same transaction.

Reading inside the lock is the point: every image write and every check
write takes the same lock, so an approval can never publish a gallery that
dropped below the minimum a moment earlier. Two approves, or an approve and
a reject, serialise; the loser gets `409 LISTING_STATE_CHANGED` or
`LISTING_NOT_APPROVABLE`, and there is one audit row.

`listing.minPhotos` is read before the transaction opens — it is platform
config behind a cache, and a config read inside a row lock only lengthens
the lock.

## `apps/api/src/modules/moderation/moderation.approval.ts`

### `export function approvalBlockers(state: ApprovalState): ApprovalBlocker[]`

The single definition of "ready to approve": the dealership is ACTIVE, the
vehicle data is complete, every check is ticked, at least `minImages` images
are attached, and one is the primary. The review screen's `blockers` and the
approve route's refusal are both this function, so the console cannot offer
an approval the API would refuse, nor hide one it would accept.

Photography status is deliberately **not** a rule. It is the operations
team's note; the images themselves are the evidence.
