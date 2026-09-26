# api / modules/listings

Parent: [api](../../README.md)

The notes below belong to the files named under each heading. Each heading is the
declaration the note sits above.

A listing is a vehicle's life on the marketplace (**F064**, as revised by
**R47**). There is one per vehicle, created with it as `DRAFT`, and only
`ACTIVE` is public.

```
DRAFT ──submit──▶ PENDING_REVIEW ──approve──▶ ACTIVE ──mark sold──▶ SOLD
                    │    ▲    │                  │
       request      │    │    └──reject──▶ REJECTED
       changes      ▼    │ resubmit              └──remove──▶ REMOVED
               CHANGES_REQUESTED
```

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

`REJECTED`, `SOLD` and `REMOVED` have no way out. A rejected car is kept, with
the moderator's reason, rather than deleted — the history is the point.

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
   on `REJECTED`, `SOLD` and `REMOVED`, which takes the vehicle out of the
   partial unique index and lets the plate be entered again (F056).

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
