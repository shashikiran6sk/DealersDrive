# api / modules/listings

Parent: [api](../../README.md)

The notes below belong to the files named under each heading. Each heading is the
declaration the note sits above.

A listing is a vehicle's life on the marketplace (**F064**, as revised by
**R47** and **R69**). There is one per vehicle, created with it as `DRAFT`.

```
DRAFT ──submit──▶ PENDING_REVIEW ──approve──▶ ACTIVE ◀──reactivate── RESERVED
                    │    ▲    │               │ │ │  ──reserve──────▶   │ │
       request      │    │    └─reject─▶ REJECTED │ └─mark sold─▶ SOLD ◀──┘ │
       changes      ▼    │ resubmit             │                          │
               CHANGES_REQUESTED                └─withdraw─▶ WITHDRAWN ◀────┘
                                                   ◀──relist──┘
```

Once a car has been live, four states are the ones a buyer can tell apart
(**R69**):

| State       | Meaning                                         | Way out                           |
| ----------- | ----------------------------------------------- | --------------------------------- |
| `ACTIVE`    | On sale                                         | reserve, mark sold, withdraw      |
| `RESERVED`  | Held for a buyer — on show, not available       | reactivate, mark sold, withdraw   |
| `SOLD`      | Sold. History, never back on sale               | none                              |
| `WITHDRAWN` | Taken off sale unsold (was `REMOVED` until R69) | relist, straight back to `ACTIVE` |

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

Reserve, reactivate, mark sold and relist are the dealership's alone; withdraw
may also be an admin's, as `remove` was before it. Only three moves reach
`ACTIVE` — approve, reactivate and relist — and the last two start from a state
that was itself reached from a reviewed, photographed listing whose data cannot
be edited outside `DRAFT` and `CHANGES_REQUESTED`, so nothing unreviewed is ever
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
