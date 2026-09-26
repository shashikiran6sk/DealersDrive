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
