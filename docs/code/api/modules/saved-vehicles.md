# api / modules/saved-vehicles

Parent: [api](../../README.md)

The notes below belong to the files named under each heading. Each heading is the
declaration the note sits above.

A signed-in customer's saved cars (**R74**, revising F087). The baseline kept
saved cars in `localStorage`, on one device and anonymous. Customer accounts
exist since R62, so the list is a table instead, keyed by the session's user
and the listing.

## `apps/api/src/modules/saved-vehicles/saved-vehicles.service.ts`

### `async save(customer, slug)`

Idempotent at three levels:

1. **An existing row answers "saved" at once.** A car saved before it was
   sold stays saved, and pressing the heart again changes nothing.
2. **The row is written with `createMany({ skipDuplicates })`.** Two
   simultaneous presses cannot both insert: the unique pair decides, and the
   loser writes nothing.
3. **The audit row is written only when a row was actually created.** So
   `vehicle.saved` counts saves, not presses.

**A new save needs a car on the marketplace**, visible by R71's rule. The
listing row is read `FOR SHARE` first, as an enquiry does. A dealer's
withdrawal takes it `FOR UPDATE`, so a save racing a withdrawal either lands
first, and is then kept by the rule below, or reads the withdrawn state and is
refused with `409 LISTING_NOT_SAVEABLE`. The outcome is deterministic either
way.

### `async unsave(customer, slug)`

`deleteMany` scoped to the session's customer. Removing a car that was never
saved removes nothing and answers the same. It works whatever the car's state,
which is how a customer clears a sold car from the list.

### Customer isolation

Every query is `where: { customerId: customer.userId }` with the id from
`customerPrincipal(req)`. No route takes a customer id, and the query schema
is `.strict()`, so there is no parameter through which to ask for someone
else's list.

## `apps/api/src/modules/saved-vehicles/saved-vehicles.mapper.ts`

### `export function savedAvailability(listing)`

The one place a saved row learns what became of its car. It returns
`AVAILABLE` or `RESERVED` while the car is visible (listing visible and
dealership `ACTIVE`), `SOLD` once sold, and `UNAVAILABLE` for everything else:
withdrawn, taken down, or the dealership suspended. A customer is told plainly
rather than shown a card that 404s when opened.

### `export function toSavedVehicle(row)`

The same `VehicleCardDto` the marketplace draws, so the web app needs no
second card. Once the car has left the marketplace, `image` is `null`: the media
route no longer serves its photographs (R71), and a broken image is worse than
the "no photograph" slot.
