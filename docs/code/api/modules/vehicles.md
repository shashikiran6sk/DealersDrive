# api / modules/vehicles

Parent: [api](../../README.md)

The notes below belong to the files named under each heading. Each heading is the
declaration the note sits above.

The module holds the car a dealership enters by hand (**F055**, as revised by
**R45** and **R46**). It has no image anywhere in it: listing photographs belong
to Dealers-Drive and arrive with the admin media model, and no schema a dealer
can write accepts a media id, an image URL or a storage key.

## `apps/api/src/modules/vehicles/vehicles.repository.ts`

### `export function createVehiclesRepository(prisma: PrismaClient)`

Every read and write a dealer can reach is keyed on `{ id, dealerId }` together.
Another dealership's vehicle therefore reads as absent rather than as
forbidden — the same rule `media.routes.ts` follows — so a guessed UUID learns
nothing about whether the row exists.

### `async updateOwned(dealerId, vehicleId, data, tx?)`

`updateMany` rather than `update`, because `update` can only address a row by a
unique key and `{ id, dealerId }` is not one. Filtering on both in one statement
is what makes the tenant check and the write a single step: there is no window
between "this row is yours" and "change it" for a second request to use.
A count of zero is reported as `null`, and the service turns that into the same
404 an unknown id gets.

### `async existingSpelling(field, value)`

The write-time half of the D1 guard rail, which R46 makes apply to every
vehicle rather than only to the RC fallback. A make or model typed in a
different case from one already stored adopts the stored spelling — the
**oldest**, so the first dealer to type `Maruti Suzuki` decides how it reads for
everybody after them. Whitespace is collapsed by the contract before this is
asked; spelling, abbreviation and synonyms are deliberately left alone.

### `async suggestions(field, prefix, limit)`

What the wizard offers while a dealer types a make or model: values already in
use, never a closed list. It is the cheapest guard against fragmentation that
does not also refuse a genuinely new model.

### `async heldRegistration(dealerId, registrationNumber, exceptVehicleId?)`

The read in front of the partial unique index
`vehicles_dealerId_registrationNumber_held_key` (**F056**): a dealership holds a
registration number once, while `releasedAt` is NULL. The read exists so the
service can answer with a sentence naming the plate; the index is what holds
when two saves of the same plate race. `exceptVehicleId` leaves out the row
being edited, so saving a draft without changing its plate is not a collision
with itself.

Another dealership may hold the same number. Cross-dealer uniqueness applies
from submission (**F065**), when a car enters the review queue — a draft is a
dealership's private notes, and letting one dealer's abandoned draft lock a
plate out for everybody would be a squatting problem the index created.

## `apps/api/src/modules/vehicles/vehicles.service.ts`

### `export function createVehiclesService({ prisma, repo, audit }: VehiclesDeps)`

The dealer's side of a vehicle (**F063**'s API): create a draft from a plate,
read it, save wizard steps into it, discard it.

**Every write and its audit row are one transaction.** `vehicle.created`,
`vehicle.updated` (with the names of the fields that changed, never their
values — a price history is not an audit trail) and `vehicle.deleted` (with the
plate it held) are written inside the transaction that made the change, so an
audit log can never describe a write that rolled back.

**The duplicate check is asked twice, on purpose.** `heldRegistration` first, so
the dealer gets a 409 naming `body.registrationNumber` with a sentence; then the
partial unique index, whose `P2002` is mapped to the _same_ 409 when two saves
race. A caller cannot tell which of the two caught it, which is the point.

### `async update(actor, vehicleId, input)`

An empty patch writes nothing and audits nothing. The wizard saves on `Back` as
well as on `Continue`, and a `vehicle.updated` row per click with no fields in
it would bury the rows that mean something.

`description: ''` is stored as NULL: an emptied text box is the dealer removing
the description, not writing an empty one.

## `apps/api/src/modules/vehicles/vehicles.mapper.ts`

### `export function toDealerListing(`

**R95.** `actions`, `canSubmit` and `canDelete` are the console's buttons, and
they are now narrowed by the member's permissions as well as by the listing's
status — through `LIFECYCLE_ACTION_PERMISSION` in contracts, the same table the
routes enforce. A STAFF member's inventory therefore has no Reserve, Sell or
Withdraw, and their review step no Submit: the console shows what the API will
allow, and the API still refuses the rest (R92). `canEdit` is not narrowed —
every member may edit a draft. Callers that pass no permissions (the service's
unit tests, an admin read) get the status-only answer, as before.

### `export function toDealerVehicle(row: VehicleRow): DealerVehicle`

The dealer DTO, and the only way a vehicle row leaves this module towards a
dealer. `issues` and `complete` are computed here with `vehicleIssues()` from
contracts, which is the same function the console imports — so the wizard's
"what is missing" and the API's refusal to submit cannot disagree. `title`
falls back to the formatted plate while a draft has no make or model yet,
because an inventory row reading "" is worse than one reading `KA 01 AB 1234`.

## `apps/api/src/modules/vehicles/routes/actor.ts`

### `export function actorOf(req: Request): VehicleActor`

The dealer and the person, both from the session. Nothing about who is acting
is read from a body, a query or a path (rule 1).

### `async submit(actor, vehicleId)`

The dealer's two moves into review (**F065**): `submit` from DRAFT and
`resubmit` from CHANGES_REQUESTED, chosen from the listing's own state so the
console needs one button. Everything happens under the `FOR UPDATE` lock on the
listing, in this order:

1. the transition is checked first, so a second submit is a `409` about the
   state rather than a `422` about completeness;
2. completeness is judged on the vehicle **as re-read under the lock**, with the
   same `vehicleIssues()` the wizard uses — a submission can never carry data
   the check did not see, and an edit that raced it waits and is then refused;
3. the registration is **claimed** (`claimedAt`, set once and never cleared);
4. `transition()` moves the listing and writes `listing.submitted` or
   `listing.resubmitted`.

**Claiming is what makes the plate unique across dealerships**, through a second
partial unique index: `(registrationNumber) WHERE releasedAt IS NULL AND claimedAt
IS NOT NULL`. A draft is private, so two dealerships may both have typed the
same plate; only one may ask Dealers-Drive to photograph and publish it. The
loser gets `409 DUPLICATE_REGISTRATION` with a sentence that does not say which
dealership has it.

The route also carries `requireDealerActive`: a dealership that has not been
approved can prepare drafts but not submit them.

### `async inventory(dealerId, query)`

The dealer's inventory (**F066**): newest first, filtered by listing status and
by a search that matches the plate with separators stripped (`ka-01-ab` finds
`KA01AB1234`) or the make or model case-insensitively. Cursor-paginated on
`(createdAt, id)`, the order it already sorts by.

**BUG-NEW-007.** The cursor used to carry `createdAt` alone with a strict `<`
boundary, so every vehicle sharing the last row's timestamp was skipped — five
tied rows in pages of two came back as two. A bulk import, or any two rows
written in the same millisecond, ties. The cursor is now the same
`encodeKeysetCursor` BUG-003 gave the other lists, and the boundary is
"older, or equally old with a smaller id". A date-only cursor issued before the
change is still honoured through `decodeKeysetOrDateCursor`.

The boundary sits under `AND` rather than beside the search, because the
search is itself an `OR` and a second `OR` key at the same level would replace
it.

`counts` is a `groupBy` over the dealership's listings, deliberately unaffected
by the filter and the search: the tabs show how many vehicles are in each state,
not how many match what was typed, and switching tab never empties the tab bar.
`ALL` is their sum.

### `async lifecycle(actor, vehicleId, action, withdrawal?)`

The five moves a dealership makes once a car has been live — reserve,
reactivate, mark sold, withdraw, relist (**R69**) — in one method, because they
differ only in the event they hand to `transition()`. Each has its own route
file, built by `apps/api/src/modules/vehicles/routes/lifecycle.ts`, rather than one
route taking an action name, so the reference lists five operations a client
can read, and nothing resembles "set the status".

It takes the listing row `FOR UPDATE` first, exactly as `submit` does, so two
moves on one car serialise: a reservation and a sale pressed together either
both land in order (`ACTIVE → RESERVED → SOLD`) or the second is refused with
the state it found. `assertTransition` runs before anything is written, so a
refused move changes nothing.

**Relist reclaims the registration.** A withdrawal made under R69 keeps the
plate, so a relist normally has nothing to do here. A listing `REMOVED` before
R69 did release it; relisting that one clears `releasedAt`, which re-enters it
into both partial unique indexes. If another dealership has claimed the same
car since, the index refuses with `P2002` and the move is answered as
`409 DUPLICATE_REGISTRATION`, the same sentence `submit` uses and for the same
reason — it does not say who has it. The transaction rolls back, so the listing
stays `WITHDRAWN`.

## Transaction authorization after resource waits

All vehicle/listing writes use the auth facade's authorizeDealerWrite inside their existing transaction. Existing-stock writes acquire the listing resource before fresh authority checks, allowing member removal or suspension to commit while a queued request is still waiting. Create has no existing listing resource and checks authority before insert. Authorization row locks remain until commit; a later removal serializes behind an already authorized write. A competing locked authority returns409 AUTHORIZATION_BUSY with no stock/audit/outbox write. Revocation401, role loss403 and non-ACTIVE lifecycle403 retain the route's business rules. DRAFT/PENDING draft create/edit/delete remains permitted for authorized roles. Returned capabilities use the fresh permission set rather than the earlier request snapshot. Empty patches remain read-only and produce no audit.

## `apps/api/src/modules/vehicles/vehicles.service.ts` — R114

### `async function authorizeAssisted(`

The Sales path's equivalent of `authorizeDealerWrite`, which is bound to a
dealer member and so cannot admit a Sales Representative. It locks the dealer
row `FOR UPDATE` and requires `assistedByMemberId` to be this member — anything
else is the same 404 a stranger gets. Drafts may be started while the dealership
is a draft or pending; submission needs it ACTIVE (`409 DEALER_NOT_APPROVED`),
which is the same rule the dealer's own submit enforces with
`requireDealerActive`. A suspended, rejected or closed dealership accepts nothing.

### `async assistedCreate(`

The same registration rules and the same duplicate checks as the dealer's
`create` — only who is recorded differs: `createdBy` (a dealer member) stays
NULL and `createdByMemberId` names the representative. The vehicle is the
dealer's: it is in their inventory and they can edit or submit it themselves.

### `async assistedList(actor: AssistedVehicleActor)`

Only vehicles this member created. The dealer's own inventory is never shown to
Sales — assisting with onboarding is not a licence to read a business's stock.
