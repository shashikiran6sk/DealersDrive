# api / modules/listings

Parent: [api](../../README.md)

The notes below belong to the files named under each heading. Each heading is the
declaration the note sits above.

A listing is a vehicle's life on the marketplace (**F064**, as revised by
**R47** and **R69**). There is one per vehicle, created with it as `DRAFT`.

```
DRAFT ──submit──▶ PENDING_REVIEW ──approve──▶ ACTIVE ──reserve──▶ RESERVED
                    │    ▲    │               │ │ ▲ ▲                 │
       request      │    │    └─reject─▶ REJECTED │ │ └─reactivate*───┘ │
       changes      ▼    │ resubmit             │ │                     │ mark
               CHANGES_REQUESTED                │ └──relist*── WITHDRAWN │ sold
                                                │ withdraw ─────▲        ▼
                                                └──mark sold──────────▶ SOLD

  * admin only — the dealer files a reactivation request, an admin approves it
```

Once a car has been live, four states are the ones a buyer can tell apart
(**R69**):

| State       | Meaning                                         | Way out                                        |
| ----------- | ----------------------------------------------- | ---------------------------------------------- |
| `ACTIVE`    | On sale                                         | reserve, mark sold, withdraw                   |
| `RESERVED`  | Held for a buyer — on show, not available       | mark sold; back on sale on an admin's approval |
| `SOLD`      | Sold. History, never back on sale               | none                                           |
| `WITHDRAWN` | Taken off sale unsold (was `REMOVED` until R69) | back on sale on an admin's approval            |

## `apps/api/src/modules/listings/listing.state.ts`

### `export const LISTING_TRANSITIONS: Record<ListingEvent, TransitionRule>`

The whole state machine, as data. Each event names the states it may leave, the
state it reaches, **who** may cause it and the audit action it writes. There is
no route and no schema that writes `status`; this table and `transition()` are
the only way a listing moves, so reading them is reading every rule there is.

Who may cause each event is part of the rule rather than a check left to the
caller: a dealer can never approve, reject or request changes — not on another
dealership's listing and not on their own — because the event refuses the actor
before it looks at the state. The wrong actor is a `403`; the wrong state is a
`409` whose code names the decision (`LISTING_NOT_SUBMITTABLE`,
`LISTING_NOT_APPROVABLE`, …) and whose body carries `listingStatus`.

`REJECTED` and `SOLD` have no way out. A rejected car is kept, with the
moderator's reason, rather than deleted — the history is the point. A sale
recorded by mistake is an administrative correction, not a toggle, which is why
no event leaves `SOLD`.

Reserve and mark sold are the dealership's alone; withdraw may also be an
admin's, as `remove` was before it, and only from `ACTIVE` — a reserved car is
sold or asked back on sale, never withdrawn. **Reactivate and relist are the
admin's alone.** A dealership cannot put a reserved or withdrawn car back on
sale itself: it files a reactivation request (`listing-reactivation.ts`), and
the admin's approval is what fires the event. Because the actor is part of the
rule, a stale or hand-rolled client calling the state machine as a dealer gets a
`403 LISTING_ACTOR_FORBIDDEN` whatever the listing's state, and there is no
dealer route that reaches either event at all. Only three moves reach `ACTIVE` —
approve, reactivate and relist — and the last two start from a state that was
itself reached from a reviewed, photographed listing whose data cannot be edited
outside `DRAFT` and `CHANGES_REQUESTED`, so nothing unreviewed is ever
published. `listing.state.test.ts` pins that list, and holds the contracts'
`LISTING_LIFECYCLE_FROM` — the console's copy of which moves exist — equal to
this table.

### `export async function transition(tx, audit, listing, event, actor, options)`

Three guarantees, all inside the caller's transaction:

1. **The expected state is in the `WHERE`.** The write is
   `updateMany({ where: { id, status: <the state we read> } })`. Two moderators
   deciding at once, or a moderator deciding while the dealer resubmits, both
   reach this line; the second finds no row in the state it expected and gets
   `409 LISTING_STATE_CHANGED`. Nothing is overwritten and only one audit row is
   written. `tests/listing-lifecycle.test.ts` races two real transactions to
   prove it.
2. **The audit row is written in the same transaction**, with the state before
   and after and the moderator's reason, so the log cannot describe a decision
   that rolled back.
3. **A terminal state releases the registration.** `vehicles.releasedAt` is set
   on `REJECTED` and `SOLD`, which takes the vehicle out of the partial unique
   index and lets the plate be entered again (F056). `WITHDRAWN` is not
   terminal and keeps the plate, so a relist can never collide with a car
   listed meanwhile; a car genuinely gone is marked sold.

The stamps are chosen by the **event**, not the target state: approve and
reactivate both reach `ACTIVE`, but only approve is a moderator's decision and
writes `decidedBy`/`decidedAt`. `reservedAt` is when the current reservation
began and is cleared by reactivate or relist; `withdrawnAt`, the withdrawal
reason and note are cleared by relist. The audit log keeps every earlier value,
with the reason and whether there was a note — not the note itself.

`publishedAt` is stamped the first time a listing goes live and never moved;
`submittedAt` is the first submission and `lastSubmittedAt` the latest, which is
what the moderation queue sorts on.

## `apps/api/src/modules/listings/listings.repository.ts`

### `export async function lockListingForVehicle(tx: Tx, vehicleId: string)`

`SELECT … FOR UPDATE` on the listing row. A dealer's edit takes this lock before
checking that the listing is still editable and writing the vehicle, and a
submission takes it before checking completeness — so an edit and a submission
of the same vehicle serialise on one row instead of interleaving, and a
moderator can never approve data that changed after it was submitted.

## `apps/api/src/modules/listings/listing-slug.ts`

### `export function listingSlug(vehicle, town)`

The public address of a listing, minted once at its first approval (F075,
F082): year, make, model, variant and the dealership's town, slugified, plus
eight random hex characters. Readable enough to be a good URL, and the suffix
means two identical cars in one town never collide and nothing about the row
can be guessed from it. It is the only identifier a buyer is given; a
re-approval keeps the slug, so a shared link keeps working.

### `export const REACTIVATION_SOURCES`

The states a reactivation request can be filed from, and the ones whose pending
request `transition()` closes. Any move out of `RESERVED` or `WITHDRAWN` other
than the approval itself — in practice, a reserved car being sold — marks a
`PENDING` request `CANCELLED` in the same transaction. That is what makes a
stale request impossible to approve: by the time an admin opens it, it is no
longer pending. The approval's own check that the listing is still in the
request's `fromStatus` is the second line, for a row moved some other way.

## `apps/api/src/modules/listings/listing-reactivation.ts`

### `export async function fileReactivationRequest(tx, audit, listing, actor, reason)`

Called with the listing already locked `FOR UPDATE`, so two requests racing
from a double click serialise on the row: the second sees the first and is a
`409 REACTIVATION_ALREADY_PENDING`. The partial unique index
`listing_reactivation_requests_one_pending_per_listing` (`UNIQUE (listingId)
WHERE status = 'PENDING'`) is the guarantee underneath, and its violation is
answered with the same 409 rather than a 500. The listing does not move. The
request copies `dealerId` from the listing, never from input (rule 1), and
audits `listing.reactivation_requested` with the dealer's words as `reason`, so
the review screen's history shows them.

### `export async function decideReactivationRequest(tx, audit, request, listing, decision, actor, adminNote, now)`

One transaction, under the listing's row lock (taken by the caller before the
request is re-read, the same lock order the dealer's moves use):

1. the request must still be `PENDING` — `409 REACTIVATION_NOT_PENDING`;
2. for an approval, the listing must still be in the request's `fromStatus` —
   `409 REACTIVATION_STALE`, and nothing is written;
3. the request is decided with its status in the `WHERE`, so two admins
   deciding at once land one;
4. an approval moves the listing through `transition()` — `reactivate` from
   `RESERVED`, `relist` from `WITHDRAWN` — so the stamps, the audit row and the
   public read (which is evaluated from `listings.status` on every request)
   follow exactly as for any other move. A withdrawn listing that released its
   registration before R69 reclaims it here, and if another dealership has
   claimed the plate since, the unique index refuses and the whole transaction
   rolls back (`409 DUPLICATE_REGISTRATION`, the request still pending);
5. `listing.reactivation_approved` or `listing.reactivation_rejected` is
   audited, with the admin's note as `reason`.

A rejection never touches the listing, which is what makes "declined" mean
"nothing happened": the car stays reserved or withdrawn, and the dealer may ask
again.

## `apps/api/src/modules/listings/listing.state.ts` — R114

### `export type ListingActorType = 'DEALER' | 'ADMIN' | 'SALES'`

`SALES` is a Dealers-Drive Sales Representative acting **for** an assisted
dealership. It may `submit` and `resubmit` — the dealer's own moves into review —
and nothing else: a Sales actor can never approve, reject, request changes,
reserve, sell, withdraw or relist. It is a separate actor type rather than
`ADMIN` so the transition table, the audit row and the moderator's history all
say what actually happened, and so an ADMIN actor still cannot submit.

### `export interface ListingActor`

`memberId` travels with a `SALES` actor so `transition()` can stamp
`listings.submittedByMemberId` on a submission. A dealer's own submission clears
it — the column means "who made the latest submission on the dealer's behalf".

### `export const LISTING_DOMAIN_EVENTS: Partial<Record<ListingEvent, DomainEventType>>`

**R115.** The moves somebody is told about — submission (and resubmission),
approval, rejection, a request for changes — are published to the outbox in the
transaction that makes them, so an email can never describe a decision that was
rolled back, and a decision can never lose its email. Selling, reserving and
withdrawing publish nothing: nobody is emailed about them. Reactivation requests
and decisions publish from `listing-reactivation.ts`, for the same reason.
