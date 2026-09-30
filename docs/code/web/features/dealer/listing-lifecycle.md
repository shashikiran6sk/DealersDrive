# web / features/dealer/listing-lifecycle

Parent: [web](../../README.md)

The dealer's controls for a car once it has been live (**R70**, the console
half of F067 as **R69** redefines it): Mark reserved, Mark sold, Withdraw and
Request reactivation.

There is no Make active and no Relist. A reserved or withdrawn car goes back on
sale only on an admin's approval, so the dealer's move is **Request
reactivation**, and while a request waits the controls say _Reactivation pending
approval_ instead of offering a second one. The server enforces the same rule —
the state machine refuses a dealer on `reactivate` and `relist`, and no dealer
route reaches either — so the missing buttons are a reflection of the rule, not
the rule.

## `apps/web/src/features/dealer/listing-lifecycle/listing-lifecycle-actions.tsx`

### `export function ListingLifecycleActions(props)`

It renders exactly the moves in `listing.actions`, which the API computes from
the same table its state machine enforces. The console never works out for
itself which moves a status allows, so it cannot offer one the server would
refuse, and a sold car shows nothing because the server lists nothing.

The Server Action is imported by its full `@/…/actions` path, not through the
barrel, so the sandbox can alias that one module to a stub (coupling C-4). The
same reasoning applies to `@/features/dealer/enquiry-actions`.

## `apps/web/src/features/dealer/listing-lifecycle/lifecycle-dialog.tsx`

### `export function LifecycleDialog(props)`

Every move changes what buyers see, so every move is confirmed, with the
sentence in `LIFECYCLE_MOVES`. Mark sold says it is final, because R69 gives no
way back from `SOLD`. Withdraw is the one destructive-toned move, and its
confirm button stays disabled until a reason is chosen. The action refuses a
reason it cannot parse before calling anything, and the API refuses one too.
Request reactivation takes an optional note for the reviewer and sends `{}`
without one, because the route's body is always a JSON object.
A refusal keeps the dialog open with the API's own sentence. A success closes
it, and the page redraws from the revalidation.

## `apps/web/src/features/dealer/listing-lifecycle/actions.ts`

### `export async function listingLifecycleAction(vehicleId, action, payload?)`

One route per move (`LIFECYCLE_PATHS`), with a body only for a withdrawal and a
reactivation request. A retired move name (`reactivate`, `relist`) is not in
`ListingLifecycleAction` and is refused before anything is called. On
success it redraws everything the move can change:

- the inventory, the dashboard counts and the vehicle's own page
- the public vehicle lists (`VEHICLES_TAG`, which `/cars` and the portfolio
  read)
- the directory's counts (`DEALERS_TAG`)
- the car's own page, by its slug

Without that last one, a car marked sold would keep a cached public page until
the tag expired.

## `apps/web/src/features/dealer/listing-lifecycle/listing-lifecycle-panel.tsx`

### `export function ListingLifecyclePanel(props)`

The foot of a live vehicle's page in the console. It shows the moves, a
withdrawn listing's reason and note (the dealership's own record, which no
public page shows), a pending reactivation request, a declined one with the
reviewer's note, and **View on site** while the car is `ACTIVE`.
