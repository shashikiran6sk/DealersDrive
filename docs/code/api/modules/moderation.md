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
