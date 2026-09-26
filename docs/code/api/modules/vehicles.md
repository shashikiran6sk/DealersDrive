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
